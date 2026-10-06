import Foundation
import SQLite3

/// All writes use SQLite transactions shared with Expo. Snapshots are presentation metadata only.
final class DailyWidgetDatabase {
  private var db: OpaquePointer?
  private let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
  private let calendar = Calendar(identifier: .gregorian)
  struct Failure: LocalizedError {
    let message: String
    var errorDescription: String? { message }
  }
  init() throws {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "DailyWidgetAppGroup") as? String,
          UserDefaults(suiteName: group)?.bool(forKey: "daily-widget-database-ready") == true,
          let root = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group) else {
      throw Failure(message: "Open Daily+ once to initialize widgets.")
    }
    let path = root.appendingPathComponent("SQLite/dailyplus.db").path
    guard sqlite3_open_v2(path, &db, SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
      sqlite3_close(db); db = nil
      throw Failure(message: "Shared database unavailable. Open Daily+ and try again.")
    }
    do {
      sqlite3_busy_timeout(db, 3000)
      try execute("PRAGMA foreign_keys = ON")
      guard number(try rows("PRAGMA user_version").first ?? [:], "user_version") == 2 else {
        throw Failure(message: "Open Daily+ to update the database.")
      }
    } catch { sqlite3_close(db); db = nil; throw error }
  }
  deinit { sqlite3_close(db) }
  private func statement(_ sql: String, _ args: [Any?]) throws -> OpaquePointer {
    var statement: OpaquePointer?
    guard sqlite3_prepare_v2(db, sql, -1, &statement, nil) == SQLITE_OK, let result = statement else { throw failure() }
    for (index, value) in args.enumerated() {
      let code: Int32
      if value == nil || value is NSNull { code = sqlite3_bind_null(result, Int32(index + 1)) }
      else { code = sqlite3_bind_text(result, Int32(index + 1), String(describing: value!), -1, transient) }
      if code != SQLITE_OK { sqlite3_finalize(result); throw failure() }
    }
    return result
  }
  private func failure() -> Failure { Failure(message: "Could not save widget action. Please retry.") }
  private func execute(_ sql: String, _ args: [Any?] = []) throws {
    let stmt = try statement(sql, args)
    defer { sqlite3_finalize(stmt) }
    guard sqlite3_step(stmt) == SQLITE_DONE else { throw failure() }
  }
  private func rows(_ sql: String, _ args: [Any?] = []) throws -> [[String: Any]] {
    let stmt = try statement(sql, args)
    defer { sqlite3_finalize(stmt) }
    var result: [[String: Any]] = []
    var code = sqlite3_step(stmt)
    while code == SQLITE_ROW {
      var row: [String: Any] = [:]
      for index in 0..<sqlite3_column_count(stmt) {
        let name = String(cString: sqlite3_column_name(stmt, index))
        switch sqlite3_column_type(stmt, index) {
        case SQLITE_INTEGER: row[name] = sqlite3_column_int64(stmt, index)
        case SQLITE_FLOAT: row[name] = sqlite3_column_double(stmt, index)
        case SQLITE_NULL: row[name] = NSNull()
        default: row[name] = String(cString: sqlite3_column_text(stmt, index))
        }
      }
      result.append(row)
      code = sqlite3_step(stmt)
    }
    guard code == SQLITE_DONE else { throw failure() }
    return result
  }
  private func number(_ row: [String: Any], _ key: String) -> Double { (row[key] as? NSNumber)?.doubleValue ?? 0 }
  private func text(_ row: [String: Any], _ key: String) -> String { row[key] as? String ?? "" }
  private func array(_ string: String) throws -> Any { try JSONSerialization.jsonObject(with: Data(string.utf8)) }
  private func active(_ id: String) throws -> [String: Any]? {
    try rows("SELECT * FROM timer_sessions WHERE task_id = ? AND status != 'finished'", [id]).first
  }
  private func stateKey(_ row: [String: Any]?) -> String {
    guard let s = row else { return "none" }
    return "\(text(s, "id")):\(text(s, "status")):\(Int64(number(s, "start_timestamp"))):\(Int64(number(s, "last_pause_timestamp")))"
  }
  func snapshot(metadata: WidgetSnapshot) throws -> WidgetSnapshot {
    try execute("BEGIN")
    do {
      var tasks: [[String: Any]] = []
      let cutoff = dateKey(Date().addingTimeInterval(-8 * 86400))
      for task in try rows("SELECT * FROM tasks WHERE archived = 0 ORDER BY created_at ASC, id ASC") {
        let id = text(task, "id")
        var values: [String: Double] = [:]
        for record in try rows("SELECT date, SUM(value) AS value FROM records WHERE task_id = ? AND date >= ? GROUP BY date", [id, cutoff]) {
          values[text(record, "date")] = number(record, "value")
        }
        let revisions = try rows("SELECT * FROM task_revisions WHERE task_id = ? ORDER BY effective_date", [id]).map { r in
          ["effectiveDate": text(r, "effective_date"), "goal": number(r, "goal"), "repeatDays": try array(text(r, "repeat_days"))] as [String: Any]
        }
        let timer: Any = try active(id).map { $0 as Any } ?? NSNull()
        tasks.append(["id": id, "name": text(task, "name"), "icon": text(task, "icon"), "color": text(task, "color"),
          "trackingType": text(task, "tracking_type"), "goal": number(task, "goal"), "unit": text(task, "unit"),
          "createdDate": dateKey(Date(timeIntervalSince1970: number(task, "created_at") / 1000)),
          "repeatDays": try array(text(task, "repeat_days")), "values": values, "revisions": revisions, "timer": timer])
      }
      let data = try JSONSerialization.data(withJSONObject: ["generatedAt": Date().timeIntervalSince1970 * 1000,
        "language": metadata.language, "theme": metadata.theme, "tasks": tasks])
      let result = try JSONDecoder().decode(WidgetSnapshot.self, from: data)
      try execute("COMMIT")
      return result
    } catch { try? execute("ROLLBACK"); throw error }
  }
  func perform(taskID: String, action: String, operation: String, expected: String) throws {
    guard (1...240).contains(operation.count), (1...240).contains(taskID.count),
          ["add", "start", "pause", "resume", "finish"].contains(action) else { throw failure() }
    let now = floor(Date().timeIntervalSince1970 * 1000)
    try execute("BEGIN IMMEDIATE")
    do {
      if try rows("SELECT id FROM widget_operations WHERE id = ?", [operation]).isEmpty {
        if let task = try rows("SELECT * FROM tasks WHERE id = ? AND archived = 0", [taskID]).first {
          let date = dateKey(Date(timeIntervalSince1970: now / 1000))
          let revision = try rows("SELECT * FROM task_revisions WHERE task_id = ? AND effective_date <= ? ORDER BY effective_date DESC LIMIT 1", [taskID, date]).first
          let days = try array(text(revision ?? task, "repeat_days")) as? [Int] ?? []
          let scheduled = dateKey(Date(timeIntervalSince1970: number(task, "created_at") / 1000)) <= date && days.contains(calendar.component(.weekday, from: Date()) - 1)
          let session = try active(taskID)
          if action == "add", text(task, "tracking_type") == "count", scheduled {
            try execute("INSERT INTO records (id,task_id,date,value,timestamp,type,operation_id) VALUES (?,?,?,1,?,'count',?)", ["widget_" + operation, taskID, date, now, operation])
          } else if text(task, "tracking_type") == "timer", stateKey(session) == expected {
            if action == "start", session == nil, scheduled {
              try execute("INSERT INTO timer_sessions (id,task_id,start_time,status,start_timestamp) VALUES (?,?,?,'running',?)", ["timer_" + UUID().uuidString, taskID, now, now])
            } else if let session = session { try changeTimer(session, action: action, now: now) }
          }
        }
        try execute("INSERT INTO widget_operations (id,timestamp) VALUES (?,?)", [operation, now])
      }
      try execute("COMMIT")
    } catch { try? execute("ROLLBACK"); throw error }
  }
  private func changeTimer(_ s: [String: Any], action: String, now: Double) throws {
    var status = text(s, "status")
    if (action == "pause" && status != "running") || (action == "resume" && status != "paused") || action == "start" { return }
    var segments = try array(text(s, "segments")) as? [[String: Double]] ?? []
    var duration = number(s, "duration")
    var start = (s["start_timestamp"] as? NSNumber)?.doubleValue
    var lastPause = (s["last_pause_timestamp"] as? NSNumber)?.doubleValue
    var paused = number(s, "paused_duration")
    var endTime: Double?
    if action == "pause" || action == "finish" {
      if status == "running", let began = start {
        let end = max(began, now)
        if end > began { segments.append(["start": began, "end": end]); duration += end - began }
        start = nil
      }
      if action == "pause" { status = "paused"; lastPause = now }
      else {
        status = "finished"
        if let pause = lastPause { paused += max(0, now - pause) }
        lastPause = nil
        endTime = max(now, max(number(s, "start_time"), segments.last?["end"] ?? 0))
        var totals: [String: (milliseconds: Double, timestamp: Double)] = [:]
        for segment in segments {
          guard var cursor = segment["start"], let end = segment["end"] else { throw failure() }
          while cursor < end {
            let date = Date(timeIntervalSince1970: cursor / 1000)
            guard let next = calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date)) else { throw failure() }
            let stop = min(end, next.timeIntervalSince1970 * 1000)
            guard stop > cursor else { throw failure() }
            let key = dateKey(date)
            totals[key] = ((totals[key]?.milliseconds ?? 0) + stop - cursor, stop - 1)
            cursor = stop
          }
        }
        let sessionID = text(s, "id")
        for (date, total) in totals {
          try execute("INSERT INTO records (id,task_id,date,value,timestamp,type,operation_id) VALUES (?,?,?,?,?,'timer',?)",
            ["timer_record_\(sessionID)_\(date)", text(s, "task_id"), date, total.milliseconds / 60000, total.timestamp, "timer:\(sessionID):\(date)"])
        }
      }
    } else if action == "resume" {
      if let pause = lastPause { paused += max(0, now - pause) }
      lastPause = nil
      start = max(now, segments.last?["end"] ?? number(s, "start_time"))
      status = "running"
    }
    let data = try JSONSerialization.data(withJSONObject: segments)
    let json = String(decoding: data, as: UTF8.self)
    try execute("UPDATE timer_sessions SET end_time=?,duration=?,status=?,start_timestamp=?,paused_duration=?,last_pause_timestamp=?,segments=? WHERE id=?",
      [endTime, duration, status, start, paused, lastPause, json, text(s, "id")])
  }
}
