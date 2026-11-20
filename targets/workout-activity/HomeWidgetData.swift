import SwiftUI
import WidgetKit

// The home screen widgets' data. The app writes it as JSON to the shared App Group
// (src/services/homeWidgets.ts → HomeWidgetStore in the workout-live-activity module) whenever what
// they show changes; the widgets only read it. Things that change with time alone (a new day, the
// streak counting up, recovery) are worked out here from dates, so the widgets stay right without
// the app running.

/// Same key as HomeWidgetStore in modules/workout-live-activity (npm run check:links checks).
let homeWidgetDataKey = "momentum.homeWidgets.v1"
private let appGroup = "group.com.momentum.fitnessapp"

struct HomeWidgetData: Codable {
  struct Nutrition: Codable {
    /// The local day these totals are for ("2026-11-20"); another day means nothing eaten yet.
    var date: String
    var kcal: Double
    var protein: Double
    var carbs: Double
    var fat: Double
    /// Nil or 0 = no goal set.
    var goalKcal: Double?
    var goalProtein: Double?
    var goalCarbs: Double?
    var goalFat: Double?
    /// Protein per meal, in the diary's meals and order (planned food left out).
    var meals: [Meal]?
  }

  struct Meal: Codable {
    var name: String
    var protein: Double
  }

  struct WorkoutTotals: Codable {
    /// Epoch ms the workout was saved.
    var at: Double
    /// kg × reps over completed sets, as the app's workout totals.
    var volume: Double
    /// Nil when the app can't count it reliably (too near the oldest loaded workout).
    var prs: Int?
  }

  struct LastWorkout: Codable {
    var id: String
    var title: String
    var at: Double
    var volume: Double
    var prs: Int
    /// The earlier session of the same routine or program day; nil = none in the loaded history.
    var previous: WorkoutTotals?
    /// No earlier session, and the app has the whole history: it really is the first time.
    var firstTime: Bool?
  }

  /// Wrapped so "no workouts yet" (latest nil) differs from "not loaded" (the section missing).
  struct LastWorkoutSection: Codable {
    var latest: LastWorkout?
  }

  /// The streak rule (src/utils/streakCalculator.ts): every day counts, rest days too, and it breaks
  /// after 3 rest days in a row. Today's streak = days from the first day of the current run of
  /// workouts to today, while the last workout was under 4 days ago.
  struct Streak: Codable {
    /// First workout day of the latest run (no gap of 4+ days inside it); nil = no workouts.
    var chainStart: String?
    /// Latest workout day.
    var lastWorkout: String?
    /// Workout days in the last 29 days (the 7 dots, the 28-day calendar).
    var recentDates: [String]
    /// Longest streak ever, as of the app's last write (the widget also counts today's run).
    var best: Int?
  }

  struct RecoveryGroup: Codable {
    var name: String
    /// Epoch ms when it was last trained as a primary muscle in the last 7 days; nil = recovered.
    var trainedAt: Double?
    /// Hours it takes to recover fully.
    var hours: Double
  }

  struct Recovery: Codable {
    var groups: [RecoveryGroup]
    /// "male" or "female": which body outline the fully recovered state shows.
    var body: String
  }

  var signedIn: Bool
  /// The user's accent ("#RRGGBB"); nil = Mono (black or white, following light/dark).
  var accentHex: String?
  var nutrition: Nutrition?
  var streak: Streak?
  var recovery: Recovery?
  var lastWorkout: LastWorkoutSection?

  static func load() -> HomeWidgetData? {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: homeWidgetDataKey),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(HomeWidgetData.self, from: data)
  }
}

// MARK: - Dates (local, like the app)

enum HomeWidgetDay {
  private static var calendar: Calendar { Calendar.autoupdatingCurrent }

  static func key(_ date: Date) -> String {
    let c = calendar.dateComponents([.year, .month, .day], from: date)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
  }

  static func date(_ key: String) -> Date? {
    let parts = key.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else { return nil }
    return calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
  }

  /// Whole days from `from` to `to` (both local days).
  static func days(from: Date, to: Date) -> Int {
    calendar.dateComponents([.day], from: calendar.startOfDay(for: from), to: calendar.startOfDay(for: to)).day ?? 0
  }

  static func nextMidnight(after date: Date) -> Date {
    calendar.date(byAdding: .day, value: 1, to: calendar.startOfDay(for: date)) ?? date.addingTimeInterval(86_400)
  }
}

// MARK: - Timeline

struct HomeWidgetEntry: TimelineEntry {
  let date: Date
  let data: HomeWidgetData?
}

/// One entry now and one at midnight (a new day); `hourly` adds one every hour until then
/// (recovery moves with time). The app also redraws the widgets whenever their data changes.
struct HomeWidgetProvider: TimelineProvider {
  var hourly = false

  func placeholder(in context: Context) -> HomeWidgetEntry {
    HomeWidgetEntry(date: Date(), data: .preview)
  }

  func getSnapshot(in context: Context, completion: @escaping (HomeWidgetEntry) -> Void) {
    completion(HomeWidgetEntry(date: Date(), data: context.isPreview ? (HomeWidgetData.load() ?? .preview) : HomeWidgetData.load()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<HomeWidgetEntry>) -> Void) {
    let data = HomeWidgetData.load()
    let now = Date()
    let midnight = HomeWidgetDay.nextMidnight(after: now)
    var dates = [now]
    if hourly {
      var next = now.addingTimeInterval(3600)
      while next < midnight {
        dates.append(next)
        next = next.addingTimeInterval(3600)
      }
    }
    dates.append(midnight)
    completion(Timeline(entries: dates.map { HomeWidgetEntry(date: $0, data: data) }, policy: .after(midnight)))
  }
}

extension HomeWidgetData {
  /// The widget gallery's sample.
  static var preview: HomeWidgetData {
    let now = Date()
    let today = HomeWidgetDay.key(now)
    let dates = [0, 1, 3, 5, 6, 8, 10].compactMap {
      Calendar.current.date(byAdding: .day, value: -$0, to: now).map(HomeWidgetDay.key)
    }
    return HomeWidgetData(
      signedIn: true,
      accentHex: nil,
      nutrition: Nutrition(
        date: today, kcal: 1580, protein: 142, carbs: 160, fat: 48, goalKcal: 2500, goalProtein: 180, goalCarbs: 280, goalFat: 80,
        meals: [Meal(name: "Breakfast", protein: 38), Meal(name: "Lunch", protein: 52), Meal(name: "Dinner", protein: 0), Meal(name: "Snacks", protein: 52)]
      ),
      streak: Streak(chainStart: dates.last, lastWorkout: dates.first, recentDates: dates, best: 34),
      recovery: Recovery(groups: [
        RecoveryGroup(name: "Back", trainedAt: nil, hours: 48),
        RecoveryGroup(name: "Quads", trainedAt: (now.timeIntervalSince1970 - 40 * 3600) * 1000, hours: 72),
        RecoveryGroup(name: "Biceps", trainedAt: (now.timeIntervalSince1970 - 30 * 3600) * 1000, hours: 48),
      ], body: "male"),
      lastWorkout: LastWorkoutSection(latest: LastWorkout(
        id: "preview", title: "Push day", at: (now.timeIntervalSince1970 - 86_400) * 1000, volume: 12450, prs: 2,
        previous: WorkoutTotals(at: (now.timeIntervalSince1970 - 8 * 86_400) * 1000, volume: 11830, prs: 0)
      ))
    )
  }
}

// MARK: - Look

/// App colours the widgets share with the app (src/theme/useColors.ts `shared`).
enum HomeWidgetColor {
  static let protein = Color(red: 0x86 / 255.0, green: 0xEF / 255.0, blue: 0xAC / 255.0)
  static let carbs = Color(red: 0x93 / 255.0, green: 0xC5 / 255.0, blue: 0xFD / 255.0)
  static let fat = Color(red: 0xE9 / 255.0, green: 0xA8 / 255.0, blue: 0xF2 / 255.0)
  static let orange = Color(red: 0xF5 / 255.0, green: 0x9E / 255.0, blue: 0x0B / 255.0)
  static let red = Color(red: 0xEF / 255.0, green: 0x44 / 255.0, blue: 0x44 / 255.0)
  static let green = Color(red: 0x34 / 255.0, green: 0xD3 / 255.0, blue: 0x99 / 255.0)
  /// The PR crown (targets/workout-activity/WorkoutLockScreen.swift prGold).
  static let gold = Color(red: 0xF5 / 255.0, green: 0xB7 / 255.0, blue: 0x00 / 255.0)

  static func accent(_ hex: String?) -> Color {
    guard var s = hex?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return .primary }
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = UInt32(s, radix: 16) else { return .primary }
    return Color(red: Double((v >> 16) & 0xFF) / 255.0, green: Double((v >> 8) & 0xFF) / 255.0, blue: Double(v & 0xFF) / 255.0)
  }
}

/// Background and padding: iOS 17's widget container (with its own margins), else our own.
struct HomeWidgetBackground: ViewModifier {
  @Environment(\.colorScheme) private var scheme

  private var fill: Color {
    scheme == .dark ? Color(red: 0.07, green: 0.07, blue: 0.075) : .white
  }

  @ViewBuilder
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(fill, for: .widget)
    } else {
      content.padding(16).background(fill)
    }
  }
}

extension View {
  func homeWidgetBackground() -> some View { modifier(HomeWidgetBackground()) }
}

/// Title row: icon + label.
struct HomeWidgetTitle: View {
  let symbol: String
  let text: String
  let tint: Color

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: symbol).font(.caption.weight(.semibold)).foregroundColor(tint).widgetAccentable()
      Text(text).font(.caption.weight(.semibold)).foregroundColor(.secondary).lineLimit(1)
    }
  }
}

/// A thin rounded bar filled to `fraction` (0...1).
struct HomeWidgetBar: View {
  let fraction: Double
  let color: Color

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(Color.primary.opacity(0.12))
        Capsule().fill(color).frame(width: geo.size.width * min(max(fraction, 0), 1)).widgetAccentable()
      }
    }
    .frame(height: 5)
  }
}

/// "Sign in to Momentum" / "Open Momentum to set up": shown when there's nothing to show.
struct HomeWidgetMessage: View {
  let symbol: String
  let title: String
  let tint: Color
  let message: String

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HomeWidgetTitle(symbol: symbol, text: title, tint: tint)
      Spacer(minLength: 0)
      Text(message).font(.subheadline.weight(.semibold)).foregroundColor(.primary).lineLimit(3)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }
}

/// The message for a missing or signed-out snapshot, or when the app hasn't loaded this widget's
/// section yet (`hasSection` false: showing zeros would look like real data); nil when there's data.
func homeWidgetBlocker(_ data: HomeWidgetData?, hasSection: Bool) -> String? {
  guard let data else { return "Open Momentum to set up this widget" }
  guard data.signedIn else { return "Sign in to Momentum" }
  return hasSection ? nil : "Open Momentum to update"
}

enum HomeWidgetLink {
  static let nutrition = URL(string: "momentum://nutrition")
  static let workouts = URL(string: "momentum://workouts")
  static let recovery = URL(string: "momentum://recovery")
  /// One workout's summary (navigation/widgetLinks.ts).
  static func workout(_ id: String) -> URL? { URL(string: "momentum://workout/" + id) }
}
