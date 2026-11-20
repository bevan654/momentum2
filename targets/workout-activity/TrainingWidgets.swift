import SwiftUI
import WidgetKit

// Small home screen widgets for training: Streak (opens Workouts) and Recovery (opens Recovery; the
// three least recovered groups, or a green body when everything is recovered).
// Both are worked out from dates at the time each entry shows, so they move on without the app:
// the streak counts up at midnight and warns on the last safe day; recovery climbs each hour.

// MARK: - D · Streak

struct StreakDay {
  let letter: String
  let trained: Bool
  let isToday: Bool
}

struct StreakState {
  let days: Int
  /// The last workout was 3 days ago: no workout today breaks the streak.
  let lastSafeDay: Bool
  let recentWorkoutDays: Int
  let dots: [StreakDay]
  /// The last 28 days, oldest first, ending today (the medium widget's calendar).
  let calendar: [StreakDay]
  /// The last 84 days, oldest first, ending today (the large widget's 12-week grid).
  let twelveWeeks: [StreakDay]
  /// Longest streak ever (the app's, or today's run if it has passed it since the app last wrote).
  let best: Int

  /// The last `count` days, oldest first, ending on `now`.
  private static func lastDays(_ count: Int, now: Date, trained: Set<String>) -> [StreakDay] {
    let cal = Calendar.autoupdatingCurrent
    return (0..<count).reversed().map { back in
      let day = cal.date(byAdding: .day, value: -back, to: now) ?? now
      let weekday = cal.component(.weekday, from: day)
      return StreakDay(
        letter: cal.veryShortStandaloneWeekdaySymbols[weekday - 1],
        trained: trained.contains(HomeWidgetDay.key(day)),
        isToday: back == 0
      )
    }
  }

  init(_ streak: HomeWidgetData.Streak?, now: Date) {
    let recent = Set(streak?.recentDates ?? [])
    dots = StreakState.lastDays(7, now: now, trained: recent)
    calendar = StreakState.lastDays(28, now: now, trained: recent)
    twelveWeeks = StreakState.lastDays(84, now: now, trained: recent)
    recentWorkoutDays = dots.filter(\.trained).count

    // The rule in src/utils/streakCalculator.ts: alive while the last workout was under 4 days ago.
    var current = 0
    var safeDay = false
    /// The run counted as the app counts its best: first to last workout, rest days after it left out.
    var run = 0
    if
      let start = streak?.chainStart.flatMap(HomeWidgetDay.date),
      let last = streak?.lastWorkout.flatMap(HomeWidgetDay.date)
    {
      let sinceLast = HomeWidgetDay.days(from: last, to: now)
      let alive = sinceLast >= 0 && sinceLast < 4
      current = alive ? HomeWidgetDay.days(from: start, to: now) + 1 : 0
      safeDay = alive && sinceLast == 3
      run = HomeWidgetDay.days(from: start, to: last) + 1
    }
    days = current
    lastSafeDay = safeDay
    // Never below today's streak, and never going down when the streak ends.
    best = max(streak?.best ?? 0, run, current)
  }
}

struct StreakWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: entry.data?.streak != nil) {
        HomeWidgetMessage(symbol: "flame.fill", title: "Streak", tint: HomeWidgetColor.orange, message: message)
      } else if family == .systemLarge {
        StreakLargeView(s: StreakState(entry.data?.streak, now: entry.date))
      } else if family == .systemMedium {
        StreakMediumView(s: StreakState(entry.data?.streak, now: entry.date))
      } else {
        content(StreakState(entry.data?.streak, now: entry.date))
      }
    }
    .homeWidgetBackground()
    .widgetURL(HomeWidgetLink.workouts)
  }

  @ViewBuilder
  private func content(_ s: StreakState) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HomeWidgetTitle(symbol: "flame.fill", text: "Streak", tint: HomeWidgetColor.orange)
      Spacer(minLength: 0)
      (Text("\(s.days)").font(.system(size: 40, weight: .bold))
        + Text(s.days == 1 ? " day" : " days").font(.subheadline.weight(.semibold)).foregroundColor(.secondary))
        .monospacedDigit()
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text(line(s))
        .font(.caption)
        .foregroundColor(s.lastSafeDay ? HomeWidgetColor.orange : .secondary)
        .lineLimit(2)
        .minimumScaleFactor(0.85)
      Spacer(minLength: 0)
      HStack(spacing: 0) {
        ForEach(Array(s.dots.enumerated()), id: \.offset) { item in
          dot(item.element, warn: s.lastSafeDay)
          if item.offset < s.dots.count - 1 { Spacer(minLength: 0) }
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  private func line(_ s: StreakState) -> String {
    if s.lastSafeDay { return "Train today to keep it" }
    if s.days == 0 { return "Start a streak today" }
    return "\(s.recentWorkoutDays) \(s.recentWorkoutDays == 1 ? "workout" : "workouts") in the last 7 days"
  }

  @ViewBuilder
  private func dot(_ day: StreakDay, warn: Bool) -> some View {
    VStack(spacing: 3) {
      ZStack {
        if day.trained {
          Circle().fill(HomeWidgetColor.orange).widgetAccentable()
        } else if day.isToday {
          Circle().strokeBorder(warn ? HomeWidgetColor.orange : Color.primary, lineWidth: 1.5)
        } else {
          Circle().fill(Color.primary.opacity(0.12))
        }
      }
      .frame(width: 14, height: 14)
      Text(day.letter)
        .font(.system(size: 9, weight: day.isToday ? .bold : .medium))
        .foregroundColor(day.isToday ? .primary : .secondary)
    }
  }
}

struct StreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumStreak", provider: HomeWidgetProvider()) { StreakWidgetView(entry: $0) }
      .configurationDisplayName("Streak")
      .description("Your workout streak, with the last 7 days (small), 28 days (medium) or 12 weeks (large).")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}

// MARK: - F · Recovery

extension HomeWidgetData.RecoveryGroup {
  /// 0...100, as the app's recovery: hours since last trained over the group's recovery hours.
  func percent(at now: Date) -> Int {
    guard let trainedAt, hours > 0 else { return 100 }
    let elapsed = (now.timeIntervalSince1970 * 1000 - trainedAt) / 3_600_000
    return Int(min(100, max(0, elapsed / hours * 100)).rounded())
  }
}

/// The app's recovery colours and thresholds (src/constants/muscleMap.ts): fatigued below 40,
/// recovering below 70, else ready.
func recoveryColor(_ percent: Int) -> Color {
  if percent < 40 { return HomeWidgetColor.red }
  if percent < 70 { return HomeWidgetColor.orange }
  return HomeWidgetColor.green
}

struct RecoveryWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: entry.data?.recovery?.groups.isEmpty == false) {
        HomeWidgetMessage(symbol: "heart.text.square.fill", title: "Recovery", tint: HomeWidgetColor.green, message: message)
      } else if family == .systemLarge {
        RecoveryLargeView(groups: entry.data?.recovery?.groups ?? [], now: entry.date)
      } else if family == .systemMedium {
        RecoveryMediumView(groups: entry.data?.recovery?.groups ?? [], now: entry.date)
      } else {
        content(entry.data?.recovery)
      }
    }
    .homeWidgetBackground()
    .widgetURL(HomeWidgetLink.recovery)
  }

  @ViewBuilder
  private func content(_ recovery: HomeWidgetData.Recovery?) -> some View {
    let groups = (recovery?.groups ?? []).enumerated()
      .map { (index: $0.offset, name: $0.element.name, percent: $0.element.percent(at: entry.date)) }
    // Least recovered first (what still needs rest); ties keep the app's group order.
    let top = groups.sorted { $0.percent != $1.percent ? $0.percent < $1.percent : $0.index < $1.index }.prefix(3)
    VStack(alignment: .leading, spacing: 0) {
      HomeWidgetTitle(symbol: "heart.text.square.fill", text: "Recovery", tint: HomeWidgetColor.green)
      if groups.allSatisfy({ $0.percent >= 100 }) {
        FullyRecoveredView(gender: recovery?.body ?? "male")
      } else {
        Spacer(minLength: 6)
        VStack(spacing: 9) {
          ForEach(Array(top), id: \.index) { g in
            VStack(spacing: 3) {
              HStack {
                Text(g.name).font(.caption.weight(.semibold)).lineLimit(1)
                Spacer(minLength: 4)
                Text("\(g.percent)%").font(.caption).monospacedDigit().foregroundColor(.secondary)
              }
              HomeWidgetBar(fraction: Double(g.percent) / 100, color: recoveryColor(g.percent))
            }
          }
        }
        Spacer(minLength: 0)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// A green body (the profile's) and "Fully recovered · Ready for anything".
private struct FullyRecoveredView: View {
  /// "male" or "female" (HomeWidgetData.Recovery.body).
  let gender: String

  var body: some View {
    VStack(spacing: 4) {
      Image(gender == "female" ? "BodyFemale" : "BodyMale")
        .resizable()
        .renderingMode(.template)
        .aspectRatio(contentMode: .fit)
        .foregroundColor(HomeWidgetColor.green)
        .widgetAccentable()
        .frame(maxHeight: .infinity)
        .padding(.vertical, 4)
      Text("Fully recovered").font(.subheadline.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.8)
      Text("Ready for anything").font(.caption2).foregroundColor(.secondary).lineLimit(1)
    }
    .frame(maxWidth: .infinity)
  }
}

struct RecoveryWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumRecovery", provider: HomeWidgetProvider(hourly: true)) { RecoveryWidgetView(entry: $0) }
      .configurationDisplayName("Recovery")
      .description("The muscle groups still recovering, updated through the day.")
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
