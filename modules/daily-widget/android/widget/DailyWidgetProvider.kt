package __PACKAGE__

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.util.TypedValue
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class DailyWidgetProvider : AppWidgetProvider() {
  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, widgetId: Int, options: Bundle) {
    onUpdate(context, manager, intArrayOf(widgetId))
  }

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val pending = goAsync()
    worker.execute {
      try { ids.forEach { update(context, manager, it) } } finally { pending.finish() }
    }
    if (ids.isNotEmpty()) scheduleMidnight(context)
    else (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(midnightIntent(context))
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == ACTION) {
      val pending = goAsync()
      worker.execute {
        var failed = false
        try {
          DailyWidgetDatabase(context).use { database ->
            database.perform(intent.getStringExtra("task") ?: "", intent.getStringExtra("command") ?: "",
              intent.getStringExtra("operation") ?: "", intent.getStringExtra("expected") ?: "")
          }
        } catch (_: Exception) { failed = true }
        try {
          val manager = AppWidgetManager.getInstance(context)
          manager.getAppWidgetIds(ComponentName(context, DailyWidgetProvider::class.java)).forEach { update(context, manager, it, failed) }
        } finally { pending.finish() }
      }
      return
    }
    super.onReceive(context, intent)
    if (intent.action in listOf(MIDNIGHT, Intent.ACTION_DATE_CHANGED, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_BOOT_COMPLETED)) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, DailyWidgetProvider::class.java))
      onUpdate(context, manager, ids)
    }
  }

  override fun onEnabled(context: Context) { scheduleMidnight(context) }
  override fun onDisabled(context: Context) {
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).cancel(midnightIntent(context))
  }

  private fun update(context: Context, manager: AppWidgetManager, widgetId: Int, actionFailed: Boolean = false) {
    val raw = context.getSharedPreferences("daily_widget", Context.MODE_PRIVATE).getString("snapshot", null)
    val cached = try { JSONObject(raw ?: "{}") } catch (_: Exception) { JSONObject() }
    var available = true
    val snapshot = try { DailyWidgetDatabase(context).use { it.snapshot(cached) } }
      catch (_: Exception) { available = false; cached }
    val chinese = snapshot.optString("language", Locale.getDefault().language).startsWith("zh")
    val dark = when (snapshot.optString("theme")) {
      "dark" -> true
      "light" -> false
      else -> (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
    }
    val text = Color.parseColor(if (dark) "#EFF5EC" else "#24352B")
    val secondary = Color.parseColor(if (dark) "#AFBEB2" else "#67766D")
    val primary = Color.parseColor(if (dark) "#8CCBA6" else "#39765C")
    val views = RemoteViews(context.packageName, R.layout.daily_widget)
    views.setInt(R.id.daily_widget_root, "setBackgroundResource", if (dark) R.drawable.daily_widget_background_dark else R.drawable.daily_widget_background)
    views.setTextColor(R.id.daily_widget_title, text)
    views.setTextColor(R.id.daily_widget_today, secondary)
    views.setTextColor(R.id.daily_widget_summary, primary)
    views.setInt(R.id.daily_widget_summary, "setBackgroundResource", if (dark) R.drawable.daily_widget_summary_dark else R.drawable.daily_widget_summary)
    views.setTextColor(R.id.daily_widget_empty, secondary)
    views.setTextColor(R.id.daily_widget_more, secondary)
    views.setTextViewText(R.id.daily_widget_today, if (chinese) "今天" else "Today")
    views.removeAllViews(R.id.daily_widget_rows)
    val calendar = java.util.GregorianCalendar()
    val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.time)
    val weekday = calendar.get(Calendar.DAY_OF_WEEK) - 1
    val tasks = snapshot.optJSONArray("tasks") ?: JSONArray()
    val scheduled = mutableListOf<JSONObject>()
    var completed = 0
    for (index in 0 until tasks.length()) {
      val task = tasks.optJSONObject(index) ?: continue
      if (task.optString("createdDate") > date) continue
      val revision = latestRevision(task, date)
      val repeatDays = revision?.optJSONArray("repeatDays") ?: task.optJSONArray("repeatDays") ?: JSONArray()
      if (!(0 until repeatDays.length()).any { repeatDays.optInt(it, -1) == weekday } && task.optJSONObject("timer") == null) continue
      scheduled.add(task)
      val goal = revision?.optDouble("goal") ?: task.optDouble("goal", 1.0)
      if ((task.optJSONObject("values")?.optDouble(date, 0.0) ?: 0.0) >= goal) completed++
    }
    views.setTextViewText(R.id.daily_widget_summary, when {
      actionFailed -> if (chinese) "未保存，请重试" else "Not saved. Please retry"
      !available -> if (chinese) "请先打开 Daily+ 初始化" else "Open Daily+ once to set up"
      else -> if (chinese) "$completed / ${scheduled.size} 已完成" else "$completed / ${scheduled.size} completed"
    })
    views.setViewVisibility(R.id.daily_widget_empty, if (scheduled.isEmpty()) android.view.View.VISIBLE else android.view.View.GONE)
    views.setTextViewText(R.id.daily_widget_empty, if (chinese) "打开 Daily+，创建第一个任务" else "Open Daily+ to create your first task")
    views.setOnClickPendingIntent(R.id.daily_widget_root, openTask(context, "dailyplus://", widgetId))
    // Budget each card against the smallest orientation and the current text size.
    val options = manager.getAppWidgetOptions(widgetId)
    val height = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 320).let { if (it > 0) it else 320 }
    val width = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250).let { if (it > 0) it else 250 }
    val fontScale = context.resources.configuration.fontScale.coerceAtLeast(1f)
    val compact = width < 320 * fontScale
    val showIcon = width >= 260 * fontScale
    // Short widgets put overflow in the header, retaining room for a 130dp active card.
    val shortHeight = height < 260 * fontScale
    val footerHeight = if (shortHeight) 0f else 18 * fontScale
    val bodyHeight = (height - 28 - (31 * fontScale + 29) - footerHeight).coerceAtLeast(0f)
    val visible = mutableListOf<JSONObject>()
    var usedHeight = 0f
    for (task in scheduled.sortedBy { if (it.optJSONObject("timer") != null) 0 else 1 }) {
      val active = task.optJSONObject("timer") != null
      val topHeight = maxOf(48f, 36 * fontScale + 12)
      val cardHeight = if (compact && active) topHeight + maxOf(48f, 30 * fontScale) + 34
        else maxOf(72f, maxOf(48f, (if (active) 55 else 36) * fontScale + (if (active) 18 else 12)) + 20) + 6
      if (visible.size >= 8 || usedHeight + cardHeight > bodyHeight) break
      visible.add(task)
      usedHeight += cardHeight
    }
    val remaining = scheduled.size - visible.size
    views.setViewVisibility(R.id.daily_widget_more, if (remaining > 0 && !shortHeight) android.view.View.VISIBLE else android.view.View.GONE)
    views.setTextViewText(R.id.daily_widget_today, (if (chinese) "今天" else "Today") + if (shortHeight && remaining > 0) " · +$remaining" else "")
    views.setTextViewText(R.id.daily_widget_more, if (chinese) "还有 $remaining 项 · 打开应用" else "$remaining more · Open app")
    if (scheduled.isNotEmpty() && visible.isEmpty()) {
      views.setViewVisibility(R.id.daily_widget_empty, android.view.View.VISIBLE)
      views.setTextViewText(R.id.daily_widget_empty, if (chinese) "放大小组件，显示习惯与计时操作" else "Resize to show habits and timer controls")
      views.setViewVisibility(R.id.daily_widget_more, android.view.View.GONE)
    }
    visible.forEachIndexed { index, task ->
      val id = task.optString("id")
      val goal = (latestRevision(task, date)?.optDouble("goal") ?: task.optDouble("goal", 1.0)).coerceAtLeast(0.000001)
      val value = task.optJSONObject("values")?.optDouble(date, 0.0) ?: 0.0
      val complete = value >= goal
      val rowLayout = if (compact) {
        if (dark) R.layout.daily_widget_row_compact_dark else R.layout.daily_widget_row_compact
      } else if (dark) R.layout.daily_widget_row_dark else R.layout.daily_widget_row
      val row = RemoteViews(context.packageName, rowLayout)
      row.setInt(R.id.daily_widget_task_row, "setBackgroundResource", if (dark) R.drawable.daily_widget_card_dark else R.drawable.daily_widget_card)
      row.setViewVisibility(R.id.daily_widget_task_icon, if (showIcon) android.view.View.VISIBLE else android.view.View.GONE)
      // A short name marker is stable across launcher fonts and avoids unsupported RemoteViews tint calls.
      val name = task.optString("name")
      val marker = if (name.isNotEmpty()) String(Character.toChars(name.codePointAt(0))) else "+"
      row.setTextViewText(R.id.daily_widget_task_icon, if (complete) "✓" else marker)
      row.setTextColor(R.id.daily_widget_task_icon, primary)
      row.setInt(R.id.daily_widget_task_icon, "setBackgroundResource", if (dark) R.drawable.daily_widget_action_dark else R.drawable.daily_widget_action)
      row.setContentDescription(R.id.daily_widget_task_icon, name)
      row.setTextViewText(R.id.daily_widget_task_name, name)
      row.setTextViewText(R.id.daily_widget_task_value, "${if (complete) "✓ " else ""}${format(value)} / ${format(goal)} ${unit(task.optString("unit"), chinese)}")
      row.setTextColor(R.id.daily_widget_task_name, text)
      row.setTextColor(R.id.daily_widget_task_value, if (complete) primary else secondary)
      row.setTextColor(R.id.daily_widget_task_add, primary)
      row.setInt(R.id.daily_widget_task_add, "setBackgroundResource", if (dark) R.drawable.daily_widget_action_dark else R.drawable.daily_widget_action)
      row.setInt(R.id.daily_widget_task_finish, "setBackgroundResource", if (dark) R.drawable.daily_widget_save_dark else R.drawable.daily_widget_save)
      row.setContentDescription(R.id.daily_widget_task_value, if (complete) (if (chinese) "已完成" else "Completed") else "${format(value)} / ${format(goal)}")
      val taskUri = "dailyplus://task/" + Uri.encode(id)
      row.setOnClickPendingIntent(R.id.daily_widget_task_row, openTask(context, taskUri, widgetId * 100 + index * 2 + 1))
      val timer = task.optJSONObject("timer")
      val countTask = task.optString("trackingType") == "count"
      val command = if (countTask) "add" else if (timer == null) "start" else if (timer.optString("status") == "running") "pause" else "resume"
      val label = when (command) {
        "add" -> if (chinese) "加一" else "Add one"
        "pause" -> if (chinese) "暂停" else "Pause"
        "resume" -> if (chinese) "继续" else "Resume"
        else -> if (chinese) "开始" else "Start"
      }
      row.setTextViewText(R.id.daily_widget_task_add, if (countTask) "+1" else when (command) {
        "pause" -> if (chinese) "暂停" else "Pause"
        "resume" -> if (chinese) "继续" else "Resume"
        else -> if (chinese) "开始" else "Start"
      })
      row.setTextViewTextSize(R.id.daily_widget_task_add, TypedValue.COMPLEX_UNIT_SP, if (countTask) 18f else if (chinese) 13f else 11f)
      row.setTextViewText(R.id.daily_widget_task_finish, if (chinese) "保存" else "Save")
      row.setContentDescription(R.id.daily_widget_task_add, "$label ${task.optString("name")}")
      row.setProgressBar(R.id.daily_widget_task_progress, 1000, (value / goal * 1000).toInt().coerceIn(0, 1000), false)
      row.setViewVisibility(R.id.daily_widget_task_finish, if (timer != null) android.view.View.VISIBLE else android.view.View.GONE)
      row.setTextColor(R.id.daily_widget_task_finish, primary)
      row.setContentDescription(R.id.daily_widget_task_finish, (if (chinese) "结束并保存 " else "Finish and save ") + task.optString("name"))
      row.setViewVisibility(R.id.daily_widget_task_timer, if (timer != null) android.view.View.VISIBLE else android.view.View.GONE)
      if (timer != null) {
        val running = timer.optString("status") == "running"
        val elapsed = timer.optDouble("duration").coerceAtLeast(0.0) + if (running && !timer.isNull("start_timestamp")) maxOf(0L, System.currentTimeMillis() - timer.optLong("start_timestamp")) else 0L
        row.setTextViewText(R.id.daily_widget_task_status, if (running) (if (chinese) "计时中" else "Running") else (if (chinese) "已暂停" else "Paused"))
        row.setTextColor(R.id.daily_widget_task_status, if (running) primary else secondary)
        row.setChronometer(R.id.daily_widget_task_clock, android.os.SystemClock.elapsedRealtime() - elapsed.toLong(), null, running)
        if (!running) {
          val seconds = elapsed.toLong() / 1000
          row.setTextViewText(R.id.daily_widget_task_clock, String.format(Locale.US, "%d:%02d", seconds / 60, seconds % 60))
        }
        row.setTextColor(R.id.daily_widget_task_clock, if (running) primary else secondary)
      }
      row.setFloat(R.id.daily_widget_task_add, "setAlpha", if (available) 1f else 0.4f)
      row.setFloat(R.id.daily_widget_task_finish, "setAlpha", if (available) 1f else 0.4f)
      row.setBoolean(R.id.daily_widget_task_add, "setEnabled", available)
      row.setBoolean(R.id.daily_widget_task_finish, "setEnabled", available)
      if (available) {
        row.setOnClickPendingIntent(R.id.daily_widget_task_add, directAction(context, widgetId, id, command, timer))
        row.setOnClickPendingIntent(R.id.daily_widget_task_finish, directAction(context, widgetId, id, "finish", timer))
      }
      views.addView(R.id.daily_widget_rows, row)
    }
    manager.updateAppWidget(widgetId, views)
  }

  private fun latestRevision(task: JSONObject, date: String): JSONObject? {
    val revisions = task.optJSONArray("revisions") ?: return null
    var latest: JSONObject? = null
    for (index in 0 until revisions.length()) {
      val revision = revisions.optJSONObject(index) ?: continue
      val effective = revision.optString("effectiveDate")
      if (effective <= date && (latest == null || effective >= latest.optString("effectiveDate"))) latest = revision
    }
    return latest
  }

  private fun openTask(context: Context, uri: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun directAction(context: Context, widgetId: Int, id: String, command: String, timer: JSONObject?): PendingIntent {
    val operation = "widget-android-" + java.util.UUID.randomUUID()
    val intent = Intent(context, DailyWidgetProvider::class.java).setAction(ACTION).apply {
      data = Uri.parse("dailyplus-widget://$widgetId/${Uri.encode(id)}/$command")
      putExtra("task", id); putExtra("command", command); putExtra("operation", operation)
      putExtra("expected", DailyWidgetDatabase.stateKey(timer))
      addFlags(Intent.FLAG_RECEIVER_FOREGROUND)
    }
    return PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun midnightIntent(context: Context): PendingIntent = PendingIntent.getBroadcast(
    context, 0, Intent(context, DailyWidgetProvider::class.java).setAction(MIDNIGHT),
    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
  )

  private fun scheduleMidnight(context: Context) {
    val next = Calendar.getInstance().apply {
      add(Calendar.DATE, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    // An inexact alarm avoids exact-alarm permission; Android may delay it in Doze.
    (context.getSystemService(Context.ALARM_SERVICE) as AlarmManager).set(AlarmManager.RTC, next.timeInMillis, midnightIntent(context))
  }

  private fun format(value: Double): String = if (value == value.toLong().toDouble()) value.toLong().toString() else String.format(Locale.getDefault(), "%.1f", value)
  private fun unit(value: String, chinese: Boolean): String = if (!chinese) value else when (value) {
    "cups" -> "杯"; "times" -> "次"; "pages" -> "页"; "ml" -> "毫升"; "min" -> "分钟"; else -> value
  }
  companion object {
    const val MIDNIGHT = "__PACKAGE__.DAILY_WIDGET_MIDNIGHT"
    const val ACTION = "__PACKAGE__.DAILY_WIDGET_ACTION"
    private val worker = java.util.concurrent.Executors.newSingleThreadExecutor()
  }
}
