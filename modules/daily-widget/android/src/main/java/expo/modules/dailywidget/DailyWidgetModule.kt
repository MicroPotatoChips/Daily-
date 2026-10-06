package expo.modules.dailywidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class DailyWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DailyWidget")
    AsyncFunction("getDatabaseDirectory") { null as String? }
    AsyncFunction("setSnapshot") { snapshot: String, databaseDirectory: String ->
      JSONObject(snapshot)
      val context = appContext.reactContext ?: throw IllegalStateException("No application context")
      val saved = context.getSharedPreferences("daily_widget", Context.MODE_PRIVATE)
        .edit().putString("snapshot", snapshot)
        .putString("databasePath", java.io.File(android.net.Uri.parse(databaseDirectory).path ?: databaseDirectory, "dailyplus.db").path).commit()
      if (!saved) throw IllegalStateException("Could not persist widget snapshot")
      val provider = ComponentName(context.packageName, context.packageName + ".DailyWidgetProvider")
      val ids = AppWidgetManager.getInstance(context).getAppWidgetIds(provider)
      if (ids.isNotEmpty()) {
        context.sendBroadcast(Intent(AppWidgetManager.ACTION_APPWIDGET_UPDATE).apply {
          component = provider
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        })
      }
    }
  }
}
