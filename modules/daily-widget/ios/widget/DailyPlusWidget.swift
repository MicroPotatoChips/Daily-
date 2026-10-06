import SwiftUI
import WidgetKit
import AppIntents

struct WidgetRevision: Decodable {
  let effectiveDate: String
  let goal: Double
  let repeatDays: [Int]
}

struct WidgetTask: Decodable, Identifiable {
  let id: String
  let name: String
  let icon: String
  let color: String
  let trackingType: String
  let goal: Double
  let unit: String
  let repeatDays: [Int]
  let createdDate: String
  let values: [String: Double]
  let revisions: [WidgetRevision]
  let timer: WidgetTimer?

  func scheduled(on date: Date) -> Bool {
    let key = dateKey(date)
    let days = revision(on: key)?.repeatDays ?? repeatDays
    return timer != nil || (createdDate <= key && days.contains(Calendar(identifier: .gregorian).component(.weekday, from: date) - 1))
  }
  func revision(on key: String) -> WidgetRevision? {
    revisions.filter { $0.effectiveDate <= key }.max { $0.effectiveDate < $1.effectiveDate }
  }
  func target(on date: Date) -> Double { revision(on: dateKey(date))?.goal ?? goal }
  func value(on date: Date) -> Double { values[dateKey(date)] ?? 0 }

}

struct WidgetSnapshot: Decodable {
  let generatedAt: Double
  let language: String
  let theme: String
  let tasks: [WidgetTask]
  static let empty = WidgetSnapshot(generatedAt: 0, language: Locale.current.languageCode ?? "en", theme: "system", tasks: [])
  var chinese: Bool { language.hasPrefix("zh") }
}

func dateKey(_ date: Date) -> String {
  let formatter = DateFormatter()
  formatter.calendar = Calendar(identifier: .gregorian)
  formatter.locale = Locale(identifier: "en_US_POSIX")
  formatter.timeZone = .current
  formatter.dateFormat = "yyyy-MM-dd"
  return formatter.string(from: date)
}

struct DailyEntry: TimelineEntry {
  let date: Date
  let snapshot: WidgetSnapshot
  var available = false
  var failed = false
  let operation = UUID().uuidString
  var tasks: [WidgetTask] { snapshot.tasks.filter { $0.scheduled(on: date) } }
  var completed: Int { tasks.filter { $0.value(on: date) >= $0.target(on: date) }.count }
}

struct WidgetTimer: Decodable {
  let id: String
  let status: String
  let duration: Double
  let start_timestamp: Double?
  let last_pause_timestamp: Double?
  var stateKey: String { "\(id):\(status):\(Int64(start_timestamp ?? 0)):\(Int64(last_pause_timestamp ?? 0))" }
  func elapsed(at date: Date) -> Double {
    duration / 1000 + (status == "running" ? max(0, date.timeIntervalSince1970 - (start_timestamp ?? date.timeIntervalSince1970 * 1000) / 1000) : 0)
  }
}

@available(iOSApplicationExtension 17.0, *)
struct DailyActionIntent: AppIntent {
  static var title: LocalizedStringResource = "Update Daily+ task"
  static var openAppWhenRun: Bool = false
  static var isDiscoverable: Bool = false
  @Parameter(title: "Task") var taskID: String
  @Parameter(title: "Action") var action: String
  @Parameter(title: "Operation") var operation: String
  @Parameter(title: "Expected state") var expected: String
  init() {}
  init(task: WidgetTask, action: String, operation: String) {
    self.taskID = task.id
    self.action = action
    self.operation = operation
    self.expected = task.timer?.stateKey ?? "none"
  }
  func perform() async throws -> some IntentResult {
    let group = Bundle.main.object(forInfoDictionaryKey: "DailyWidgetAppGroup") as? String ?? ""
    let defaults = UserDefaults(suiteName: group)
    defer { WidgetCenter.shared.reloadTimelines(ofKind: "DailyPlusWidget") }
    do {
      try DailyWidgetDatabase().perform(taskID: taskID, action: action, operation: operation, expected: expected)
      defaults?.set(false, forKey: "daily-widget-action-failed")
    } catch {
      defaults?.set(true, forKey: "daily-widget-action-failed")
      throw error
    }
    return .result()
  }
}

struct DailyProvider: TimelineProvider {
  func placeholder(in context: Context) -> DailyEntry { DailyEntry(date: Date(), snapshot: .empty) }
  func getSnapshot(in context: Context, completion: @escaping (DailyEntry) -> Void) { completion(readEntry()) }
  func getTimeline(in context: Context, completion: @escaping (Timeline<DailyEntry>) -> Void) {
    let entry = readEntry()
    let calendar = Calendar(identifier: .gregorian)
    let midnight = calendar.startOfDay(for: entry.date)
    var entries = [entry]
    for offset in 1...8 {
      if let date = calendar.date(byAdding: .day, value: offset, to: midnight) {
        entries.append(DailyEntry(date: date, snapshot: entry.snapshot, available: entry.available, failed: entry.failed))
      }
    }
    // Request fresh database data tomorrow; future entries remain an offline fallback.
    completion(Timeline(entries: entries, policy: .after(calendar.date(byAdding: .day, value: 1, to: midnight)!)))
  }
  private func readEntry() -> DailyEntry {
    let group = Bundle.main.object(forInfoDictionaryKey: "DailyWidgetAppGroup") as? String ?? ""
    let defaults = UserDefaults(suiteName: group)
    let metadata = defaults?.data(forKey: "daily-widget-snapshot").flatMap { try? JSONDecoder().decode(WidgetSnapshot.self, from: $0) } ?? .empty
    do {
      return DailyEntry(date: Date(), snapshot: try DailyWidgetDatabase().snapshot(metadata: metadata), available: true,
        failed: defaults?.bool(forKey: "daily-widget-action-failed") ?? false)
    } catch { return DailyEntry(date: Date(), snapshot: metadata) }
  }
}

extension Color {
  init(widgetHex: String) {
    let hex = widgetHex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))
    let number = UInt64(hex, radix: 16) ?? 0x538E7D
    self.init(.sRGB, red: Double((number >> 16) & 255) / 255, green: Double((number >> 8) & 255) / 255, blue: Double(number & 255) / 255, opacity: 1)
  }
}

func taskSymbol(_ icon: String) -> String {
  switch icon {
  case "droplets": return "drop.fill"
  case "activity": return "figure.run"
  case "book-open": return "book.fill"
  case "flower": return "sparkles"
  case "stretch": return "figure.flexibility"
  case "moon": return "moon.fill"
  case "apple": return "fork.knife"
  case "heart": return "heart.fill"
  case "sun": return "sun.max.fill"
  case "coffee": return "cup.and.saucer.fill"
  case "graduation-cap": return "graduationcap.fill"
  default: return "leaf.fill"
  }
}

struct DailyWidgetView: View {
  @Environment(\.widgetFamily) var family
  @Environment(\.colorScheme) var colorScheme
  var entry: DailyEntry
  private var compact: Bool { family == .systemMedium }
  private var chinese: Bool { entry.snapshot.chinese }
  private var dark: Bool { entry.snapshot.theme == "dark" || (entry.snapshot.theme == "system" && colorScheme == .dark) }
  private var primaryText: Color { Color(widgetHex: dark ? "#EFF5EC" : "#24352B") }
  private var secondaryText: Color { Color(widgetHex: dark ? "#AFBEB2" : "#67766D") }
  private var visibleTasks: [WidgetTask] {
    let tasks = entry.tasks.filter { $0.timer != nil } + entry.tasks.filter { $0.timer == nil }
    let limit: Int
    if !compact { limit = 4 }
    else if #available(iOSApplicationExtension 17.0, *) { limit = entry.available && !entry.failed ? 2 : 1 }
    else { limit = 1 }
    return Array(tasks.prefix(limit))
  }
  private var remaining: Int { entry.tasks.count - visibleTasks.count }
  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 3 : 10) {
      HStack {
        Text("Daily+").font(.system(size: 19, weight: .semibold, design: .default))
        Spacer()
        Text("\(entry.completed)/\(entry.tasks.count)").font(.system(size: 13, weight: .medium)).monospacedDigit()
        Text((chinese ? "今天" : "Today") + (remaining > 0 ? " · +\(remaining)" : ""))
          .font(.system(size: 13, weight: .medium)).foregroundStyle(secondaryText)
      }
      if !entry.available || entry.failed {
        Text(entry.failed ? (chinese ? "未保存，请重试" : "Not saved. Please retry") : (chinese ? "请先打开 Daily+ 初始化" : "Open Daily+ once to set up"))
          .font(.system(size: 12)).foregroundStyle(secondaryText)
      }
      if entry.tasks.isEmpty {
        Text(chinese ? "打开 Daily+，创建第一个任务" : "Open Daily+ to create your first task")
          .font(.system(size: 16)).foregroundStyle(secondaryText)
        Spacer(minLength: 0)
      } else {
        VStack(alignment: .leading, spacing: compact ? 3 : 10) {
          ForEach(visibleTasks) { task in taskRow(task) }
        }
        if !compact { Spacer(minLength: 0) }
      }
      if #unavailable(iOSApplicationExtension 17.0) {
        Text(chinese ? "直接操作需要 iOS 17" : "Direct actions require iOS 17").font(.system(size: 12)).foregroundStyle(secondaryText)
      }
    }
    .preferredColorScheme(entry.snapshot.theme == "dark" ? .dark : entry.snapshot.theme == "light" ? .light : nil)
    .foregroundStyle(primaryText)
    .widgetURL(URL(string: "dailyplus://"))
    .modifier(WidgetSurface())
  }
  private func taskRow(_ task: WidgetTask) -> some View {
    let value = task.value(on: entry.date)
    let target = max(0.000001, task.target(on: entry.date))
    let accent = Color(widgetHex: dark ? "#8CCBA6" : task.color)
    let encoded = task.id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/?#"))) ?? task.id
    return HStack(spacing: 8) {
      Link(destination: URL(string: "dailyplus://task/\(encoded)")!) {
        VStack(alignment: .leading, spacing: 1) {
          HStack(spacing: 4) {
            Image(systemName: value >= target ? "checkmark.circle.fill" : taskSymbol(task.icon)).foregroundStyle(accent)
            Text(task.name).foregroundStyle(primaryText).lineLimit(1)
          }.font(.system(size: compact ? 14 : 16, weight: .semibold, design: .default))
          Text("\(value.formatted(.number.precision(.fractionLength(0...1)))) / \(target.formatted(.number.precision(.fractionLength(0...1)))) \(unit(task.unit))")
            .font(.system(size: compact ? 12 : 13, weight: .medium)).monospacedDigit().foregroundStyle(secondaryText).lineLimit(1).minimumScaleFactor(0.8)
          if let timer = task.timer {
            HStack(spacing: 5) {
              Text(timer.status == "running" ? (chinese ? "计时中" : "Running") : (chinese ? "已暂停" : "Paused"))
              if timer.status == "running" {
                Text(entry.date.addingTimeInterval(-timer.elapsed(at: entry.date)), style: .timer).monospacedDigit()
              } else {
                Text("\(Int(timer.duration / 60000)):\(String(format: "%02d", Int(timer.duration / 1000) % 60))").monospacedDigit()
              }
            }.font(.system(size: compact ? 11 : 12, weight: .medium)).foregroundStyle(timer.status == "running" ? accent : secondaryText).lineLimit(1)
          }
          if !compact || task.timer == nil {
            ProgressView(value: min(1, max(0, value / target))).tint(accent)
              .accessibilityLabel(chinese ? "完成度" : "Progress")
              .accessibilityValue("\(Int(min(100, max(0, value / target * 100))))%")
          }
        }.frame(maxWidth: .infinity, alignment: .leading)
      }.buttonStyle(.plain)
      if #available(iOSApplicationExtension 17.0, *) {
        HStack(spacing: 4) {
          let command = task.trackingType == "count" ? "add" : task.timer == nil ? "start" : task.timer?.status == "running" ? "pause" : "resume"
          actionButton(task, command: command, symbol: command == "add" ? "plus" : command == "pause" ? "pause.fill" : "play.fill")
          if task.timer != nil { actionButton(task, command: "finish", symbol: "checkmark") }
        }
      }
    }
  }
  private func unit(_ value: String) -> String {
    guard chinese else { return value }
    switch value {
    case "cups": return "杯"
    case "times": return "次"
    case "pages": return "页"
    case "ml": return "毫升"
    case "min": return "分钟"
    default: return value
    }
  }
  @available(iOSApplicationExtension 17.0, *)
  private func actionButton(_ task: WidgetTask, command: String, symbol: String) -> some View {
    let label: String
    switch command {
    case "add": label = chinese ? "加一" : "Add one"
    case "pause": label = chinese ? "暂停" : "Pause"
    case "resume": label = chinese ? "继续" : "Resume"
    case "finish": label = chinese ? "结束并保存" : "Finish and save"
    default: label = chinese ? "开始" : "Start"
    }
    return Button(intent: DailyActionIntent(task: task, action: command, operation: "\(entry.operation):\(task.id):\(command)")) {
      Image(systemName: symbol).font(.system(size: 17, weight: .semibold))
        .frame(width: 44, height: 44)
        .background(Color(widgetHex: dark ? "#2B4635" : "#E1EEE5"), in: RoundedRectangle(cornerRadius: 16))
    }
    .buttonStyle(.plain).tint(Color(widgetHex: dark ? "#8CCBA6" : task.color)).disabled(!entry.available)
    .accessibilityLabel("\(label) \(task.name)")
  }
}

struct WidgetSurface: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOSApplicationExtension 17.0, *) {
      content.containerBackground(for: .widget) { Color("WidgetBackground") }
    } else { content.padding(14).background(Color("WidgetBackground")) }
  }
}

@main
struct DailyPlusWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "DailyPlusWidget", provider: DailyProvider()) { entry in DailyWidgetView(entry: entry) }
      .configurationDisplayName("Daily+")
      .description(NSLocalizedString("widget.description", value: "Today's habits, one tap away.", comment: "Widget description"))
      .supportedFamilies([.systemMedium, .systemLarge])
  }
}
