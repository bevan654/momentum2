import SwiftUI
import WidgetKit

// The medium sizes of the Macros and Streak widgets. The small layouts and the shared pieces live
// in NutritionWidgets.swift, TrainingWidgets.swift and HomeWidgetData.swift; Last workout is in
// LastWorkoutWidget.swift.

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
