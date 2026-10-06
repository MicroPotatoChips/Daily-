package __PACKAGE__

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.UUID

/** The widget and Expo use the same WAL database, never a write-back snapshot. */
class DailyWidgetDatabase(context: Context) : java.io.Closeable {
  private val db: SQLiteDatabase
  init {
    val path = context.getSharedPreferences("daily_widget", Context.MODE_PRIVATE).getString("databasePath", null)
      ?: throw IllegalStateException("Open Daily+ once to initialize widgets")
    val file = File(path).canonicalFile
    require(file.path.startsWith(File(context.applicationInfo.dataDir).canonicalPath + File.separator) && file.name == "dailyplus.db")
    db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE or SQLiteDatabase.ENABLE_WRITE_AHEAD_LOGGING)
    db.execSQL("PRAGMA busy_timeout = 3000")
    db.execSQL("PRAGMA foreign_keys = ON")
    if (db.version != 2) { db.close(); throw IllegalStateException("Open Daily+ to update the database") }
  }
  override fun close() = db.close()
  private fun rows(sql: String, vararg args: String): List<JSONObject> = db.rawQuery(sql, args).use { cursor ->
    buildList {
      while (cursor.moveToNext()) {
        val row = JSONObject()
        cursor.columnNames.forEachIndexed { index, name ->
          row.put(name, when (cursor.getType(index)) {
            android.database.Cursor.FIELD_TYPE_NULL -> JSONObject.NULL
            android.database.Cursor.FIELD_TYPE_INTEGER -> cursor.getLong(index)
            android.database.Cursor.FIELD_TYPE_FLOAT -> cursor.getDouble(index)
            else -> cursor.getString(index)
          })
        }
        add(row)
      }
    }
  }
  private fun execute(sql: String, vararg args: Any?) = db.execSQL(sql, args)
  fun snapshot(fallback: JSONObject): JSONObject {
    db.execSQL("BEGIN")
    try {
      val result = JSONObject(fallback.toString())
      val tasks = JSONArray()
      for (task in rows("SELECT * FROM tasks WHERE archived = 0 ORDER BY created_at ASC, id ASC")) {
        val id = task.getString("id")
        val values = JSONObject()
        rows("SELECT date, SUM(value) AS value FROM records WHERE task_id = ? AND date >= ? GROUP BY date", id,
          dateKey(System.currentTimeMillis() - 8 * 86400000L)).forEach { values.put(it.getString("date"), it.getDouble("value")) }
        val revisions = JSONArray()
        rows("SELECT * FROM task_revisions WHERE task_id = ? ORDER BY effective_date", id).forEach {
          revisions.put(JSONObject().put("effectiveDate", it.getString("effective_date")).put("goal", it.getDouble("goal"))
            .put("repeatDays", JSONArray(it.getString("repeat_days"))))
        }
        tasks.put(JSONObject().put("id", id).put("name", task.getString("name")).put("icon", task.getString("icon"))
          .put("color", task.getString("color")).put("trackingType", task.getString("tracking_type"))
          .put("goal", task.getDouble("goal")).put("unit", task.getString("unit"))
          .put("repeatDays", JSONArray(task.getString("repeat_days"))).put("createdDate", dateKey(task.getLong("created_at")))
          .put("values", values).put("revisions", revisions).put("timer", active(id) ?: JSONObject.NULL))
      }
      result.put("tasks", tasks).put("generatedAt", System.currentTimeMillis())
      db.execSQL("COMMIT")
      return result
    } catch (error: Exception) { db.execSQL("ROLLBACK"); throw error }
  }
  private fun active(id: String) = rows("SELECT * FROM timer_sessions WHERE task_id = ? AND status != 'finished'", id).firstOrNull()
  fun perform(id: String, action: String, operation: String, expected: String) {
    require(operation.length in 1..240 && id.length in 1..240)
    require(action in listOf("add", "start", "pause", "resume", "finish"))
    val now = System.currentTimeMillis()
    db.execSQL("BEGIN IMMEDIATE")
    try {
      if (rows("SELECT id FROM widget_operations WHERE id = ?", operation).isEmpty()) {
        val task = rows("SELECT * FROM tasks WHERE id = ? AND archived = 0", id).firstOrNull()
        if (task != null) {
          val session = active(id)
          val date = dateKey(now)
          val revision = rows("SELECT * FROM task_revisions WHERE task_id = ? AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1", id, date).firstOrNull()
          val days = JSONArray((revision ?: task).getString("repeat_days"))
          val weekday = java.util.GregorianCalendar().get(Calendar.DAY_OF_WEEK) - 1
          val scheduled = dateKey(task.getLong("created_at")) <= date && (0 until days.length()).any { days.optInt(it) == weekday }
          if (action == "add" && task.getString("tracking_type") == "count" && scheduled) {
            execute("INSERT INTO records (id,task_id,date,value,timestamp,type,operation_id) VALUES (?,?,?,1,?,'count',?)", "widget_$operation", id, date, now, operation)
          } else if (task.getString("tracking_type") == "timer" && stateKey(session) == expected) {
            if (action == "start" && session == null && scheduled) {
              execute("INSERT INTO timer_sessions (id,task_id,start_time,status,start_timestamp) VALUES (?,?,?,'running',?)", "timer_" + UUID.randomUUID(), id, now, now)
            } else if (session != null) changeTimer(session, action, now)
          }
        }
        execute("INSERT INTO widget_operations (id,timestamp) VALUES (?,?)", operation, now)
      }
      db.execSQL("COMMIT")
    } catch (error: Exception) { db.execSQL("ROLLBACK"); throw error }
  }
  private fun changeTimer(s: JSONObject, action: String, now: Long) {
    var status = s.getString("status")
    if (action == "pause" && status != "running" || action == "resume" && status != "paused" || action == "start") return
    val segments = JSONArray(s.getString("segments"))
    var duration = s.getDouble("duration")
    var start: Long? = if (s.isNull("start_timestamp")) null else s.getLong("start_timestamp")
    var paused = s.getDouble("paused_duration")
    var lastPause: Long? = if (s.isNull("last_pause_timestamp")) null else s.getLong("last_pause_timestamp")
    var endTime: Long? = null
    if (action == "pause" || action == "finish") {
      if (status == "running" && start != null) {
        val end = maxOf(start, now)
        if (end > start) { segments.put(JSONObject().put("start", start).put("end", end)); duration += end - start }
        start = null
      }
      if (action == "pause") { status = "paused"; lastPause = now }
      else {
        status = "finished"
        if (lastPause != null) paused += maxOf(0L, now - lastPause)
        lastPause = null
        endTime = maxOf(now, s.getLong("start_time"), segments.optJSONObject(segments.length() - 1)?.optLong("end") ?: 0L)
        val totals = linkedMapOf<String, Pair<Long, Long>>()
        for (index in 0 until segments.length()) {
          val segment = segments.getJSONObject(index)
          var cursor = segment.getLong("start")
          val end = segment.getLong("end")
          while (cursor < end) {
            val midnight = java.util.GregorianCalendar().apply { timeInMillis = cursor; add(Calendar.DATE, 1); set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis
            val stop = minOf(midnight, end)
            check(stop > cursor)
            val key = dateKey(cursor)
            totals[key] = Pair((totals[key]?.first ?: 0) + stop - cursor, stop - 1)
            cursor = stop
          }
        }
        totals.forEach { (date, total) ->
          val sessionId = s.getString("id")
          execute("INSERT INTO records (id,task_id,date,value,timestamp,type,operation_id) VALUES (?,?,?,?,?,'timer',?)",
            "timer_record_${sessionId}_$date", s.getString("task_id"), date, total.first / 60000.0, total.second, "timer:$sessionId:$date")
        }
      }
    } else if (action == "resume") {
      if (lastPause != null) paused += maxOf(0L, now - lastPause)
      lastPause = null
      start = maxOf(now, segments.optJSONObject(segments.length() - 1)?.optLong("end") ?: s.getLong("start_time"))
      status = "running"
    }
    execute("UPDATE timer_sessions SET end_time=?,duration=?,status=?,start_timestamp=?,paused_duration=?,last_pause_timestamp=?,segments=? WHERE id=?",
      endTime, duration, status, start, paused, lastPause, segments.toString(), s.getString("id"))
  }
  companion object {
    fun dateKey(timestamp: Long): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(java.util.Date(timestamp))
    fun stateKey(s: JSONObject?): String = if (s == null) "none" else "${s.getString("id")}:${s.getString("status")}:${s.optLong("start_timestamp", 0)}:${s.optLong("last_pause_timestamp", 0)}"
  }
}
