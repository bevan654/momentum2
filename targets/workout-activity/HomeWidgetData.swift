import SwiftUI
import WidgetKit

// The home screen widgets' data. The app writes it as JSON to the shared App Group
// (src/services/homeWidgets.ts → HomeWidgetStore in the workout-live-activity module) whenever what
// they show changes; the widgets only read it. Things that change with time alone (a new day, the
// streak counting up) are worked out here from dates, so the widgets stay right without the app
// running.

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
    /// The meal's calories, carbs and fat (the large Macros widget).
    var kcal: Double?
    var carbs: Double?
    var fat: Double?
  }

  /// A micronutrient the user set a goal for, with today's intake.
  struct Micro: Codable {
    var name: String
    var unit: String
    var amount: Double
    var goal: Double
  }

  /// Today's amount of water (ml) or creatine (g) against its daily goal.
  struct Amount: Codable {
    var amount: Double
    var goal: Double
  }

  /// The large Macros widget's micronutrients and supplements, for one local day.
  struct NutritionExtras: Codable {
    var date: String
    var micros: [Micro]?
    var water: Amount?
    /// Nil when creatine isn't tracked.
    var creatine: Amount?
  }

  /// The streak rule (src/utils/streakCalculator.ts): every day counts, rest days too, and it breaks
  /// after 3 rest days in a row. Today's streak = days from the first day of the current run of
  /// workouts to today, while the last workout was under 4 days ago.
  struct Streak: Codable {
    /// First workout day of the latest run (no gap of 4+ days inside it); nil = no workouts.
    var chainStart: String?
    /// Latest workout day.
    var lastWorkout: String?
    /// Workout days in the last 85 days (the 7 dots, the 28-day calendar, the 12-week grid).
    var recentDates: [String]
    /// Longest streak ever, as of the app's last write (the widget also counts today's run).
    var best: Int?
  }

  /// One tile of the Supplements widget: water or a tracked supplement.
  struct SupplementTile: Codable {
    /// "water" or the supplement's key.
    var key: String
    var name: String
    var unit: String
    var amount: Double
    var goal: Double
    /// What one tap adds (the first quick amount).
    var step: Double
    /// An SF Symbol.
    var icon: String
    /// "#RRGGBB"; nil = the water colour.
    var color: String?
  }

  /// The Supplements widget: water first, then the supplements in the app's order, for one local day.
  struct Supplements: Codable {
    var date: String
    var tiles: [SupplementTile]
  }

  var signedIn: Bool
  /// Who the data belongs to (taps carry it, so the app applies them to the right account).
  var userId: String?
  /// The user's accent ("#RRGGBB"); nil = Mono (black or white, following light/dark).
  var accentHex: String?
  var nutrition: Nutrition?
  var streak: Streak?
  var nutritionExtras: NutritionExtras?
  var supplements: Supplements?

  static func load() -> HomeWidgetData? {
    guard
      let json = UserDefaults(suiteName: appGroup)?.string(forKey: homeWidgetDataKey),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(HomeWidgetData.self, from: data)
  }
}

// MARK: - Decoding: one part the widgets can't read never blanks the others

extension HomeWidgetData {
  /// Each part decodes on its own: one with a value the widgets can't read (renamed, null, the
  /// wrong type) is left out, so its widget asks to open the app while the others still show.
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    signedIn = try c.decode(Bool.self, forKey: .signedIn)
    userId = try? c.decodeIfPresent(String.self, forKey: .userId)
    accentHex = try? c.decodeIfPresent(String.self, forKey: .accentHex)
    nutrition = try? c.decodeIfPresent(Nutrition.self, forKey: .nutrition)
    streak = try? c.decodeIfPresent(Streak.self, forKey: .streak)
    nutritionExtras = try? c.decodeIfPresent(NutritionExtras.self, forKey: .nutritionExtras)
    supplements = try? c.decodeIfPresent(Supplements.self, forKey: .supplements)
  }
}

/// Decodes anything, to step past an array element that didn't decode.
private struct SkippedValue: Decodable {
  init(from decoder: Decoder) throws {}
}

extension HomeWidgetData.Supplements {
  /// A tile that can't be read is skipped; the rest still show.
  init(from decoder: Decoder) throws {
    let c = try decoder.container(keyedBy: CodingKeys.self)
    date = try c.decode(String.self, forKey: .date)
    var list = try c.nestedUnkeyedContainer(forKey: .tiles)
    var tiles: [HomeWidgetData.SupplementTile] = []
    while !list.isAtEnd {
      let index = list.currentIndex
      if (try? list.decodeNil()) == true { continue }
      if let tile = try? list.decode(HomeWidgetData.SupplementTile.self) {
        tiles.append(tile)
      } else {
        _ = try? list.decode(SkippedValue.self)
      }
      // Never loop on an element that couldn't be stepped past.
      if list.currentIndex == index { break }
    }
    self.tiles = tiles
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

/// One entry now and one at midnight (a new day). The app also redraws the widgets whenever their
/// data changes.
struct HomeWidgetProvider: TimelineProvider {
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
    completion(Timeline(entries: [now, midnight].map { HomeWidgetEntry(date: $0, data: data) }, policy: .after(midnight)))
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
      userId: nil,
      accentHex: nil,
      nutrition: Nutrition(
        date: today, kcal: 1580, protein: 142, carbs: 160, fat: 48, goalKcal: 2500, goalProtein: 180, goalCarbs: 280, goalFat: 80,
        meals: [
          Meal(name: "Breakfast", protein: 38, kcal: 520, carbs: 62, fat: 14),
          Meal(name: "Lunch", protein: 52, kcal: 710, carbs: 70, fat: 20),
          Meal(name: "Dinner", protein: 0, kcal: 0, carbs: 0, fat: 0),
          Meal(name: "Snacks", protein: 52, kcal: 350, carbs: 28, fat: 14),
        ]
      ),
      streak: Streak(chainStart: dates.last, lastWorkout: dates.first, recentDates: dates, best: 34),
      nutritionExtras: NutritionExtras(
        date: today,
        micros: [Micro(name: "Fiber", unit: "g", amount: 18, goal: 30), Micro(name: "Sodium", unit: "mg", amount: 1650, goal: 2300)],
        water: Amount(amount: 1800, goal: 3000),
        creatine: Amount(amount: 5, goal: 5)
      ),
      supplements: Supplements(date: today, tiles: [
        SupplementTile(key: "water", name: "Water", unit: "ml", amount: 1800, goal: 3000, step: 250, icon: "drop.fill", color: nil),
        SupplementTile(key: "creatine", name: "Creatine", unit: "g", amount: 5, goal: 5, step: 5, icon: "bolt.fill", color: "#FBBF24"),
        SupplementTile(key: "vitamin_d", name: "Vitamin D", unit: "IU", amount: 0, goal: 2000, step: 1000, icon: "sun.max.fill", color: "#F97316"),
        SupplementTile(key: "fish_oil", name: "Fish Oil", unit: "mg", amount: 1000, goal: 1000, step: 1000, icon: "fish.fill", color: "#06B6D4"),
        SupplementTile(key: "magnesium", name: "Magnesium", unit: "mg", amount: 200, goal: 400, step: 200, icon: "sparkles", color: "#8B5CF6"),
        SupplementTile(key: "caffeine", name: "Caffeine", unit: "mg", amount: 100, goal: 200, step: 100, icon: "cup.and.saucer.fill", color: "#92400E"),
      ])
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
  static let water = Color(red: 0x60 / 255.0, green: 0xA5 / 255.0, blue: 0xFA / 255.0)
  /// The app icon's red (assets/logo.png), for the Momentum mark.
  static let brand = Color(red: 0xDC / 255.0, green: 0x2B / 255.0, blue: 0x2B / 255.0)

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

/// The "M" of the app icon (assets/logo.png), drawn from its shapes so it stays sharp at any size.
struct MomentumMark: Shape {
  /// The icon's 1024 pt artwork, trimmed to the mark: x 152…866, y 357…660.
  private static let artwork: [[(CGFloat, CGFloat)]] = [
    [(313, 357), (473, 357), (510, 425), (545, 357), (707, 357), (787, 509), (393, 509)],
    [(232, 509), (393, 509), (313, 660), (152, 660)],
    [(393, 509), (553, 509), (633, 660), (473, 660)],
    [(626, 509), (787, 509), (866, 660), (706, 660)],
  ]
  private static let pieces: [[CGPoint]] = artwork.map { piece in
    piece.map { point in CGPoint(x: point.0 - 152, y: point.1 - 357) }
  }
  /// Width over height.
  static let aspect: CGFloat = 714.0 / 303.0

  func path(in rect: CGRect) -> Path {
    let sx = rect.width / 714, sy = rect.height / 303
    var path = Path()
    for piece in Self.pieces {
      path.addLines(piece.map { CGPoint(x: rect.minX + $0.x * sx, y: rect.minY + $0.y * sy) })
      path.closeSubpath()
    }
    return path
  }
}

/// The Momentum mark in the icon's red, top right of every widget.
struct HomeWidgetBrand: View {
  var height: CGFloat = 10

  var body: some View {
    MomentumMark()
      .fill(HomeWidgetColor.brand)
      .frame(width: height * MomentumMark.aspect, height: height)
      .accessibilityLabel("Momentum")
  }
}

/// Title row: icon + label, and the Momentum mark at the far end (`brand` false where the row
/// doesn't span the widget and the mark sits elsewhere).
struct HomeWidgetTitle: View {
  let symbol: String
  let text: String
  let tint: Color
  var brand = true

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: symbol).font(.caption.weight(.semibold)).foregroundColor(tint).widgetAccentable()
      Text(text).font(.caption.weight(.semibold)).foregroundColor(.secondary).lineLimit(1)
      if brand {
        Spacer(minLength: 4)
        HomeWidgetBrand()
      }
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
}
