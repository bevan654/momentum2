import SwiftUI
import WidgetKit

// The medium sizes of the home screen widgets (Macros, Protein, Streak, Recovery) and the
// Last workout widget (medium; its large size is in LargeWidgets.swift). The small layouts and the shared pieces live in
// NutritionWidgets.swift, TrainingWidgets.swift and HomeWidgetData.swift.

// MARK: - Macros (medium)

/// The calorie ring (or calories eaten without a goal) beside the three bars, as eaten / goal.
struct MacrosMediumView: View {
  let n: HomeWidgetData.Nutrition
  let accent: Color

  var body: some View {
    HStack(spacing: 16) {
      VStack(spacing: 4) {
        if let target = nutritionGoal(n.goalKcal) {
          CalorieRingView(eaten: n.kcal, goal: target, accent: accent)
          Text("\(kcalText(n.kcal)) / \(kcalText(target))").font(.caption2).monospacedDigit().foregroundColor(.secondary)
        } else {
          NoGoalView(value: kcalText(n.kcal), unit: "kcal eaten")
        }
      }
      .frame(width: 108)
      VStack(spacing: 10) {
        MacroRow(name: "Protein", eaten: n.protein, goal: nutritionGoal(n.goalProtein), color: HomeWidgetColor.protein, showsTotal: true)
        MacroRow(name: "Carbs", eaten: n.carbs, goal: nutritionGoal(n.goalCarbs), color: HomeWidgetColor.carbs, showsTotal: true)
        MacroRow(name: "Fat", eaten: n.fat, goal: nutritionGoal(n.goalFat), color: HomeWidgetColor.fat, showsTotal: true)
      }
      .frame(maxWidth: .infinity)
    }
  }
}

// MARK: - Protein (medium)

/// "142 / 180 g · 38 g to go" over one column per meal (the diary's meals, in its order).
struct ProteinMediumView: View {
  let n: HomeWidgetData.Nutrition

  var body: some View {
    let meals = n.meals ?? []
    let tallest = max(meals.map(\.protein).max() ?? 0, 1)
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        HomeWidgetTitle(symbol: "fork.knife", text: "Protein", tint: HomeWidgetColor.protein)
        Spacer(minLength: 6)
        header.font(.caption).monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
      }
      if meals.isEmpty {
        Spacer(minLength: 0)
        Text("\(Int(n.protein.rounded())) g eaten today").font(.title3.weight(.bold)).monospacedDigit()
        Spacer(minLength: 0)
      } else {
        HStack(alignment: .bottom, spacing: 10) {
          ForEach(Array(meals.prefix(6).enumerated()), id: \.offset) { item in
            MealColumn(meal: item.element, tallest: tallest)
          }
        }
      }
    }
  }

  @ViewBuilder
  private var header: some View {
    if let target = nutritionGoal(n.goalProtein) {
      if n.protein >= target {
        Label("Goal hit", systemImage: "checkmark").foregroundColor(HomeWidgetColor.protein)
      } else {
        Text("\(Int(n.protein.rounded())) / \(grams(target)) · \(grams(target - n.protein)) to go").foregroundColor(.secondary)
      }
    } else {
      Text("\(grams(n.protein)) · Set a goal in Momentum").foregroundColor(.secondary)
    }
  }
}

private struct MealColumn: View {
  let meal: HomeWidgetData.Meal
  let tallest: Double

  var body: some View {
    VStack(spacing: 3) {
      GeometryReader { geo in
        VStack {
          Spacer(minLength: 0)
          RoundedRectangle(cornerRadius: 5, style: .continuous)
            .fill(meal.protein > 0 ? HomeWidgetColor.protein : Color.primary.opacity(0.12))
            .frame(height: meal.protein > 0 ? max(6, geo.size.height * meal.protein / tallest) : 6)
            .widgetAccentable()
        }
      }
      Text(meal.name).font(.system(size: 10, weight: .medium)).foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.7)
      Text(meal.protein > 0 ? grams(meal.protein) : "–").font(.caption2.weight(.semibold)).monospacedDigit().lineLimit(1)
    }
    .frame(maxWidth: .infinity)
  }
}

// MARK: - Streak (medium)

/// The streak and best streak beside a 28-day calendar that ends today.
struct StreakMediumView: View {
  let s: StreakState

  var body: some View {
    HStack(spacing: 14) {
      VStack(alignment: .leading, spacing: 2) {
        HomeWidgetTitle(symbol: "flame.fill", text: "Streak", tint: HomeWidgetColor.orange)
        Spacer(minLength: 0)
        Text("\(s.days)").font(.system(size: 40, weight: .bold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
        Text(s.lastSafeDay ? "Train today to keep it" : (s.days == 0 ? "Start a streak today" : (s.days == 1 ? "day" : "days")))
          .font(.caption)
          .foregroundColor(s.lastSafeDay ? HomeWidgetColor.orange : .secondary)
          .lineLimit(2)
        Spacer(minLength: 0)
        Text("Best: \(s.best) \(s.best == 1 ? "day" : "days")").font(.caption2).foregroundColor(.secondary).lineLimit(1)
      }
      .frame(width: 104, alignment: .leading)
      calendar
    }
  }

  /// 4 rows of 7, oldest first; the column letters follow the first row's days.
  private var calendar: some View {
    let rows = stride(from: 0, to: s.calendar.count, by: 7).map { Array(s.calendar[$0..<min($0 + 7, s.calendar.count)]) }
    return VStack(spacing: 5) {
      HStack(spacing: 0) {
        ForEach(Array((rows.first ?? []).enumerated()), id: \.offset) { item in
          Text(item.element.letter).font(.system(size: 9, weight: .medium)).foregroundColor(.secondary).frame(maxWidth: .infinity)
        }
      }
      ForEach(Array(rows.enumerated()), id: \.offset) { row in
        HStack(spacing: 0) {
          ForEach(Array(row.element.enumerated()), id: \.offset) { item in
            square(item.element).frame(maxWidth: .infinity)
          }
        }
      }
    }
  }

  @ViewBuilder
  private func square(_ day: StreakDay) -> some View {
    let shape = RoundedRectangle(cornerRadius: 3, style: .continuous)
    Group {
      if day.trained {
        shape.fill(HomeWidgetColor.orange).widgetAccentable()
      } else if day.isToday {
        shape.strokeBorder(s.lastSafeDay ? HomeWidgetColor.orange : Color.primary, lineWidth: 1.5)
      } else {
        shape.fill(Color.primary.opacity(0.12))
      }
    }
    .frame(width: 13, height: 13)
  }
}

// MARK: - Recovery (medium)

/// The 8 least recovered groups in two columns; "Fully recovered" when everything is at 100%.
struct RecoveryMediumView: View {
  let groups: [HomeWidgetData.RecoveryGroup]
  let now: Date

  var body: some View {
    let rows = groups.enumerated()
      .map { (index: $0.offset, name: $0.element.name, percent: $0.element.percent(at: now)) }
      .sorted { $0.percent != $1.percent ? $0.percent < $1.percent : $0.index < $1.index }
    VStack(alignment: .leading, spacing: 6) {
      HomeWidgetTitle(symbol: "heart.text.square.fill", text: "Recovery", tint: HomeWidgetColor.green)
      if rows.allSatisfy({ $0.percent >= 100 }) {
        Spacer(minLength: 0)
        HStack(spacing: 10) {
          Image(systemName: "checkmark.circle.fill").font(.title).foregroundColor(HomeWidgetColor.green).widgetAccentable()
          VStack(alignment: .leading, spacing: 1) {
            Text("Fully recovered").font(.headline)
            Text("Ready for anything").font(.caption).foregroundColor(.secondary)
          }
        }
        Spacer(minLength: 0)
      } else {
        let top = Array(rows.prefix(8))
        HStack(alignment: .top, spacing: 16) {
          column(Array(top.prefix(4)))
          column(Array(top.dropFirst(4)))
        }
        Spacer(minLength: 0)
      }
    }
  }

  private func column(_ items: [(index: Int, name: String, percent: Int)]) -> some View {
    VStack(spacing: 5) {
      ForEach(items, id: \.index) { g in
        VStack(spacing: 3) {
          HStack {
            Text(g.name).font(.caption2.weight(.semibold)).lineLimit(1)
            Spacer(minLength: 4)
            Text("\(g.percent)%").font(.caption2).monospacedDigit().foregroundColor(.secondary)
          }
          HomeWidgetBar(fraction: Double(g.percent) / 100, color: recoveryColor(g.percent))
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .top)
  }
}

// MARK: - Last workout (medium and large)

private func dayText(_ ms: Double, now: Date) -> String {
  let date = Date(timeIntervalSince1970: ms / 1000)
  switch HomeWidgetDay.days(from: date, to: now) {
  case 0: return "Today"
  case 1: return "Yesterday"
  default:
    let f = DateFormatter()
    f.setLocalizedDateFormatFromTemplate("EEE d MMM")
    return f.string(from: date)
  }
}

private func kgText(_ value: Double) -> String { "\(kcalText(value)) kg" }

struct LastWorkoutWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let section = entry.data?.lastWorkout
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: section != nil) {
        HomeWidgetMessage(symbol: "dumbbell.fill", title: "Last workout", tint: tint, message: message)
      } else if let w = section?.latest {
        if family == .systemLarge {
          VStack(alignment: .leading, spacing: 10) {
            content(w).frame(height: 118)
            ExerciseBestsView(exercises: w.exercises ?? [], compared: w.previous != nil)
          }
        } else {
          content(w)
        }
      } else {
        HomeWidgetMessage(symbol: "dumbbell.fill", title: "Last workout", tint: tint, message: "Finish a workout to see it here")
      }
    }
    .homeWidgetBackground()
    .widgetURL(section?.latest.flatMap { HomeWidgetLink.workout($0.id) } ?? HomeWidgetLink.workouts)
  }

  private var tint: Color { HomeWidgetColor.accent(entry.data?.accentHex) }

  @ViewBuilder
  private func content(_ w: HomeWidgetData.LastWorkout) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HStack {
        HomeWidgetTitle(symbol: "dumbbell.fill", text: "Last workout · \(dayText(w.at, now: entry.date))", tint: tint)
        Spacer(minLength: 6)
        if let previous = w.previous {
          Text("vs \(dayText(previous.at, now: entry.date))").font(.caption2).foregroundColor(.secondary).lineLimit(1)
        }
      }
      Text(w.title).font(.title3.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7).padding(.top, 2)
      Spacer(minLength: 0)
      HStack(alignment: .top, spacing: 28) {
        VStack(alignment: .leading, spacing: 1) {
          Text("Volume").font(.caption2).foregroundColor(.secondary)
          Text(kgText(w.volume)).font(.title3.weight(.bold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
          volumeChange(w)
        }
        VStack(alignment: .leading, spacing: 1) {
          Text("PRs").font(.caption2).foregroundColor(.secondary)
          Label("\(w.prs)", systemImage: "crown.fill")
            .font(.title3.weight(.bold))
            .foregroundColor(w.prs > 0 ? HomeWidgetColor.gold : .primary)
            .monospacedDigit()
          if let prs = w.previous?.prs {
            Text("last time \(prs)").font(.caption2).foregroundColor(.secondary)
          }
        }
      }
      if w.previous == nil {
        Text(w.firstTime == true ? "First time · nothing to compare yet" : "Nothing recent to compare with")
          .font(.caption2).foregroundColor(.secondary).lineLimit(1).padding(.top, 2)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private func volumeChange(_ w: HomeWidgetData.LastWorkout) -> some View {
    if let previous = w.previous {
      let change = (w.volume - previous.volume).rounded()
      if change > 0 {
        Text("+\(kgText(change))").font(.caption.weight(.semibold)).monospacedDigit().foregroundColor(HomeWidgetColor.green)
      } else if change < 0 {
        Text("−\(kgText(-change))").font(.caption.weight(.semibold)).monospacedDigit().foregroundColor(HomeWidgetColor.red)
      } else {
        Text("Same as last time").font(.caption).foregroundColor(.secondary)
      }
    }
  }
}

struct LastWorkoutWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumLastWorkout", provider: HomeWidgetProvider()) { LastWorkoutWidgetView(entry: $0) }
      .configurationDisplayName("Last workout")
      .description("Your latest workout's volume and PRs against the previous time you did it.")
      .supportedFamilies([.systemMedium, .systemLarge])
  }
}
