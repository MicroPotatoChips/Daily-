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
  @Environment(\.dynamicTypeSize) var dynamicTypeSize
  @ScaledMetric(relativeTo: .caption) private var compactTitleSize: CGFloat = 13
  @ScaledMetric(relativeTo: .subheadline) private var regularTitleSize: CGFloat = 15
  @ScaledMetric(relativeTo: .caption2) private var progressTextSize: CGFloat = 11
  @ScaledMetric(relativeTo: .caption2) private var timerTextSize: CGFloat = 10
  var entry: DailyEntry

  private var compact: Bool { family == .systemMedium }
  private var chinese: Bool { entry.snapshot.chinese }
  private var dark: Bool { entry.snapshot.theme == "dark" || (entry.snapshot.theme == "system" && colorScheme == .dark) }
  private var primaryText: Color { Color(widgetHex: dark ? "#EFF5EC" : "#24352B") }
  private var secondaryText: Color { Color(widgetHex: dark ? "#AFBEB2" : "#67766D") }
  private var primary: Color { Color(widgetHex: dark ? "#8CCBA6" : "#39765C") }
  private var surface: Color { Color(widgetHex: dark ? "#1F2B23" : "#FFFFFF") }
  private var track: Color { Color(widgetHex: dark ? "#28372D" : "#EEF1E9") }
  private var buttonText: Color { Color(widgetHex: dark ? "#13291C" : "#FFFFFF") }
  private var directActionsAvailable: Bool {
    if #available(iOSApplicationExtension 17.0, *) { return true }
    return false
  }
  private var showNotice: Bool { !entry.available || entry.failed || !directActionsAvailable }
  private var visibleTasks: [WidgetTask] {
    let tasks = entry.tasks.filter { $0.timer != nil } + entry.tasks.filter { $0.timer == nil }
    let limit: Int
    if compact { limit = showNotice || dynamicTypeSize > .large ? 1 : 2 }
    else if dynamicTypeSize.isAccessibilitySize { limit = 2 }
    else { limit = showNotice || dynamicTypeSize > .large ? 3 : 4 }
    return Array(tasks.prefix(limit))
  }
  private var remaining: Int { max(0, entry.tasks.count - visibleTasks.count) }

  var body: some View {
    VStack(alignment: .leading, spacing: compact ? 6 : 8) {
      header
      if !entry.available || entry.failed {
        Text(entry.failed ? (chinese ? "未保存，点击操作重试" : "Not saved. Tap an action to retry") : (chinese ? "打开 Daily+ 完成初始化" : "Open Daily+ to finish setup"))
          .font(.system(size: 11, design: .default)).foregroundStyle(secondaryText).lineLimit(2)
      }
      if entry.tasks.isEmpty {
        emptyState
      } else {
        VStack(alignment: .leading, spacing: compact ? 6 : 7) {
          ForEach(visibleTasks) { task in taskRow(task) }
        }
      }
      if #unavailable(iOSApplicationExtension 17.0) {
        Text(chinese ? "iOS 17 起支持直接操作" : "Direct actions require iOS 17")
          .font(.system(size: 11, design: .default)).foregroundStyle(secondaryText).lineLimit(2)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .preferredColorScheme(entry.snapshot.theme == "dark" ? .dark : entry.snapshot.theme == "light" ? .light : nil)
    .foregroundStyle(primaryText)
    .widgetURL(URL(string: "dailyplus://"))
    .modifier(WidgetSurface())
  }

  private var header: some View {
    HStack(spacing: 6) {
      Text("Daily+").font(.system(size: compact ? 16 : 18, weight: .semibold, design: .default))
      Spacer(minLength: 4)
      HStack(spacing: 4) {
        Image(systemName: "checkmark.circle.fill").foregroundStyle(primary)
        Text(chinese ? "今日完成" : "Today")
        Text("\(entry.completed)/\(entry.tasks.count)").monospacedDigit()
      }
      .font(.system(size: 11, weight: .medium, design: .default))
      .padding(.horizontal, 7).padding(.vertical, 4)
      .background(track, in: Capsule())
      .accessibilityElement(children: .ignore)
      .accessibilityLabel(chinese ? "今日已完成 \(entry.completed) 项，共 \(entry.tasks.count) 项" : "\(entry.completed) of \(entry.tasks.count) habits completed today")
      if remaining > 0 {
        Text("+\(remaining)").font(.system(size: 10, weight: .medium)).foregroundStyle(secondaryText)
          .accessibilityLabel(chinese ? "还有 \(remaining) 项" : "\(remaining) more habits")
      }
    }
  }

  private var emptyState: some View {
    VStack(spacing: 6) {
      Spacer(minLength: 0)
      Image(systemName: "leaf.fill").font(.system(size: compact ? 24 : 30)).foregroundStyle(primary)
      Text(chinese ? "今天，从一个小习惯开始" : "Start with one small habit")
        .font(.subheadline.weight(.semibold)).multilineTextAlignment(.center)
      Text(chinese ? "打开 Daily+ 添加你的第一个习惯" : "Open Daily+ to add your first habit")
        .font(.caption).foregroundStyle(secondaryText).multilineTextAlignment(.center)
      Spacer(minLength: 0)
    }.frame(maxWidth: .infinity)
  }

  private func taskRow(_ task: WidgetTask) -> some View {
    let value = task.value(on: entry.date)
    let target = max(0.000001, task.target(on: entry.date))
    let progress = min(1, max(0, value / target))
    let accent = Color(widgetHex: task.color)
    let encoded = task.id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed.subtracting(CharacterSet(charactersIn: "/?#"))) ?? task.id
    return HStack(spacing: 6) {
      Link(destination: URL(string: "dailyplus://task/\(encoded)")!) {
        HStack(spacing: 7) {
          Image(systemName: taskSymbol(task.icon))
            .font(.system(size: compact ? 14 : 16, weight: .semibold))
            .foregroundStyle(accent)
            .frame(width: compact ? 28 : 32, height: compact ? 28 : 32)
            .background(accent.opacity(dark ? 0.18 : 0.10), in: RoundedRectangle(cornerRadius: 10))
          VStack(alignment: .leading, spacing: 1) {
            Text(task.name).font(.system(size: compact ? min(compactTitleSize, 24) : min(regularTitleSize, 30), weight: .semibold, design: .default))
              .foregroundStyle(primaryText).lineLimit(1).truncationMode(.tail)
            Text("\(value.formatted(.number.precision(.fractionLength(0...1)))) / \(target.formatted(.number.precision(.fractionLength(0...1)))) \(unit(task.unit))")
              .font(.system(size: min(progressTextSize, compact ? 16 : 18), weight: .medium, design: .default))
              .monospacedDigit().foregroundStyle(secondaryText).lineLimit(1).minimumScaleFactor(0.8)
            if let timer = task.timer {
              timerStatus(timer)
            } else {
              GeometryReader { geometry in
                ZStack(alignment: .leading) {
                  Capsule().fill(track)
                  Capsule().fill(accent).frame(width: geometry.size.width * CGFloat(progress))
                }
              }
              .frame(height: compact ? 3 : 4)
              .padding(.top, 2)
              .accessibilityElement(children: .ignore)
              .accessibilityLabel(chinese ? "完成度" : "Progress")
              .accessibilityValue("\(Int(progress * 100))%")
            }
          }.frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
        .contentShape(Rectangle())
      }
      .buttonStyle(.plain)
      .accessibilityElement(children: .combine)
      .accessibilityHint(chinese ? "打开习惯详情" : "Open habit details")
      if #available(iOSApplicationExtension 17.0, *) {
        HStack(spacing: 4) {
          let command = task.trackingType == "count" ? "add" : task.timer == nil ? "start" : task.timer?.status == "running" ? "pause" : "resume"
          actionButton(task, command: command, symbol: command == "add" ? "plus" : command == "pause" ? "pause.fill" : "play.fill")
          if task.timer != nil { actionButton(task, command: "finish", symbol: "checkmark") }
        }.fixedSize(horizontal: true, vertical: false)
      }
    }
    .padding(.horizontal, 8).padding(.vertical, compact ? 3 : 5)
    .frame(minHeight: compact ? 52 : 60)
    .background(surface, in: RoundedRectangle(cornerRadius: compact ? 14 : 16))
    .overlay {
      RoundedRectangle(cornerRadius: compact ? 14 : 16).stroke(primary.opacity(dark ? 0.08 : 0.04), lineWidth: 0.75)
    }
  }

  private func timerStatus(_ timer: WidgetTimer) -> some View {
    HStack(spacing: 4) {
      Circle().fill(timer.status == "running" ? primary : secondaryText).frame(width: 4, height: 4)
      Text(timer.status == "running" ? (chinese ? "计时中" : "Running") : (chinese ? "已暂停" : "Paused"))
      if timer.status == "running" {
        Text(entry.date.addingTimeInterval(-timer.elapsed(at: entry.date)), style: .timer).monospacedDigit()
      } else {
        Text(pausedTime(timer.duration)).monospacedDigit()
      }
    }
    .font(.system(size: min(timerTextSize, compact ? 14 : 16), weight: .medium, design: .default))
    .foregroundStyle(timer.status == "running" ? primary : secondaryText)
    .lineLimit(1).minimumScaleFactor(0.8)
  }

  private func pausedTime(_ duration: Double) -> String {
    let seconds = Int(max(0, duration) / 1000)
    if seconds >= 3600 { return String(format: "%d:%02d:%02d", seconds / 3600, seconds / 60 % 60, seconds % 60) }
    return String(format: "%d:%02d", seconds / 60, seconds % 60)
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
    let visibleLabel: String
    switch command {
    case "add": label = chinese ? "加一" : "Add one"; visibleLabel = "+1"
    case "pause": label = chinese ? "暂停" : "Pause"; visibleLabel = label
    case "resume": label = chinese ? "继续" : "Resume"; visibleLabel = label
    case "finish": label = chinese ? "结束并保存" : "Finish and save"; visibleLabel = chinese ? "完成" : "Save"
    default: label = chinese ? "开始" : "Start"; visibleLabel = label
    }
    return Button(intent: DailyActionIntent(task: task, action: command, operation: "\(entry.operation):\(task.id):\(command)")) {
      VStack(spacing: 2) {
        Image(systemName: symbol).font(.system(size: 13, weight: .semibold))
        Text(visibleLabel).font(.system(size: 10, weight: .semibold, design: .default)).lineLimit(1)
      }
      .frame(width: 44).frame(minHeight: 44)
      .foregroundStyle(command == "finish" ? primary : buttonText)
      .background(command == "finish" ? primary.opacity(dark ? 0.14 : 0.10) : primary, in: RoundedRectangle(cornerRadius: 12))
    }
    .buttonStyle(.plain).disabled(!entry.available).opacity(entry.available ? 1 : 0.45)
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
