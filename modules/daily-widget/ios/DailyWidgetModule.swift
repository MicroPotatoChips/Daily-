import Foundation
import ExpoModulesCore
import WidgetKit

public class DailyWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DailyWidget")
    AsyncFunction("getDatabaseDirectory") { () -> String in
      guard let group = Bundle.main.object(forInfoDictionaryKey: "DailyWidgetAppGroup") as? String,
            let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
        throw NSError(domain: "DailyWidget", code: 3, userInfo: [NSLocalizedDescriptionKey: "Daily+ shared storage is unavailable."])
      }
      let directory = root.appendingPathComponent("SQLite", isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      return directory.path
    }
    AsyncFunction("setSnapshot") { (snapshot: String, databaseDirectory: String) in
      guard let group = Bundle.main.object(forInfoDictionaryKey: "DailyWidgetAppGroup") as? String,
            let defaults = UserDefaults(suiteName: group) else {
        throw NSError(domain: "DailyWidget", code: 1, userInfo: [NSLocalizedDescriptionKey: "Daily+ App Group is not configured."])
      }
      guard let data = snapshot.data(using: .utf8),
            (try? JSONSerialization.jsonObject(with: data)) != nil else {
        throw NSError(domain: "DailyWidget", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid widget snapshot."])
      }
      defaults.set(data, forKey: "daily-widget-snapshot")
      defaults.set(true, forKey: "daily-widget-database-ready")
      WidgetCenter.shared.reloadTimelines(ofKind: "DailyPlusWidget")
    }
  }
}
