import SwiftUI
import WidgetKit

// The large sizes of the Macros (ring, bars, meals, micronutrients, supplements) and Streak
// (12 weeks) widgets. Small and medium layouts and the shared pieces live in NutritionWidgets.swift,
// TrainingWidgets.swift, MediumWidgets.swift and HomeWidgetData.swift; Last workout is in
// LastWorkoutWidget.swift.

// MARK: - Macros (large)

struct MacrosLargeView: View {
  let n: HomeWidgetData.Nutrition
  let extras: HomeWidgetData.NutritionExtras?
  let accent: Color
  let now: Date

  var body: some View {
    // Today's micronutrients and supplements; another day's count as nothing yet.
    let today = extras?.date == HomeWidgetDay.key(now)
    let micros = Array((extras?.micros ?? []).prefix(4))
    let water = extras?.water
    let creatine = extras?.creatine
    let meals = n.meals ?? []
    // Sized to fit the large widget on every iPhone, the SE's (about 292 pt) included: with
    // micronutrients or supplements below, 3 meals at most (then "+N more"), else 4.
    let mealLimit = (!micros.isEmpty || water != nil || creatine != nil) ? 3 : 4
    VStack(alignment: .leading, spacing: 5) {
      MacrosMediumView(n: n, accent: accent).frame(height: 104)
      if !meals.isEmpty {
        Divider()
        VStack(spacing: 4) {
          ForEach(Array(meals.prefix(mealLimit).enumerated()), id: \.offset) { item in
            MealMacrosRow(meal: item.element)
          }
          if meals.count > mealLimit {
            Text("+\(meals.count - mealLimit) more").font(.caption2).foregroundColor(.secondary).frame(maxWidth: .infinity, alignment: .leading)
          }
        }
      }
      if !micros.isEmpty {
        Divider()
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 14), GridItem(.flexible())], spacing: 7) {
          ForEach(Array(micros.enumerated()), id: \.offset) { item in
            MicroRow(micro: item.element, amount: today ? item.element.amount : 0)
          }
        }
      }
      if water != nil || creatine != nil {
        Divider()
        HStack(spacing: 14) {
          if let water {
            SupplementLabel(symbol: "drop.fill", text: "Water \(litres(today ? water.amount : 0)) / \(litres(water.goal)) L", done: today && water.goal > 0 && water.amount >= water.goal)
          }
          if let creatine {
            SupplementLabel(symbol: "pills.fill", text: "Creatine \(Int((today ? creatine.amount : 0).rounded())) / \(Int(creatine.goal.rounded())) g", done: today && creatine.goal > 0 && creatine.amount >= creatine.goal)
          }
          Spacer(minLength: 0)
        }
      }
    }
    .frame(maxHeight: .infinity, alignment: .top)
  }

  private func litres(_ ml: Double) -> String {
    let l = ml / 1000
    return l == l.rounded() ? String(Int(l)) : String(format: "%.1f", l)
  }
}

/// "Lunch   710 kcal · 52 g · 70 g · 20 g" (protein, carbs, fat in their colours).
private struct MealMacrosRow: View {
  let meal: HomeWidgetData.Meal

  var body: some View {
    HStack(spacing: 6) {
      Text(meal.name).font(.caption.weight(.semibold)).lineLimit(1)
      Spacer(minLength: 4)
      if (meal.kcal ?? 0) <= 0 && meal.protein <= 0 {
        Text("–").font(.caption).foregroundColor(.secondary)
      } else {
        let dot: Text = Text(" · ").foregroundColor(.secondary)
        let kcal: Text = Text("\(kcalText(meal.kcal ?? 0)) kcal").foregroundColor(.secondary)
        let protein: Text = Text(grams(meal.protein)).foregroundColor(HomeWidgetColor.protein)
        let carbs: Text = Text(grams(meal.carbs ?? 0)).foregroundColor(HomeWidgetColor.carbs)
        let fat: Text = Text(grams(meal.fat ?? 0)).foregroundColor(HomeWidgetColor.fat)
        (kcal + dot + protein + dot + carbs + dot + fat)
          .font(.caption2)
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
    }
  }
}

/// "Fibre   18 / 30 g" over a thin bar.
private struct MicroRow: View {
  let micro: HomeWidgetData.Micro
  let amount: Double

  var body: some View {
    VStack(spacing: 2) {
      HStack {
        Text(micro.name).font(.caption2.weight(.semibold)).lineLimit(1)
        Spacer(minLength: 2)
        Text("\(amountText(amount)) / \(amountText(micro.goal)) \(micro.unit)")
          .font(.caption2).monospacedDigit().foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.8)
      }
      HomeWidgetBar(fraction: micro.goal > 0 ? amount / micro.goal : 0, color: .secondary)
    }
  }

  private func amountText(_ v: Double) -> String {
    v >= 10 || v == v.rounded() ? String(Int(v.rounded())) : String(format: "%.1f", v)
  }
}

private struct SupplementLabel: View {
  let symbol: String
  let text: String
  let done: Bool

  var body: some View {
    HStack(spacing: 4) {
      Image(systemName: done ? "checkmark.circle.fill" : symbol)
        .font(.caption.weight(.semibold))
        .foregroundColor(done ? HomeWidgetColor.green : .secondary)
      Text(text).font(.caption2).monospacedDigit().lineLimit(1).minimumScaleFactor(0.8)
    }
  }
}

// MARK: - Streak (large)

/// Streak, best and workouts in 12 weeks over a 12-week grid (a column per week, ending today).
struct StreakLargeView: View {
  let s: StreakState

  var body: some View {
    let weeks = stride(from: 0, to: s.twelveWeeks.count, by: 7).map { Array(s.twelveWeeks[$0..<min($0 + 7, s.twelveWeeks.count)]) }
    let workoutDays = s.twelveWeeks.filter(\.trained).count
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .bottom) {
        VStack(alignment: .leading, spacing: 0) {
          HomeWidgetTitle(symbol: "flame.fill", text: "Streak", tint: HomeWidgetColor.orange)
          (Text("\(s.days)").font(.system(size: 40, weight: .bold))
            + Text(s.days == 1 ? " day" : " days").font(.subheadline.weight(.semibold)).foregroundColor(.secondary))
            .monospacedDigit()
            .lineLimit(1)
          if s.lastSafeDay {
            Text("Train today to keep it").font(.caption).foregroundColor(HomeWidgetColor.orange)
          } else if s.days == 0 {
            Text("Start a streak today").font(.caption).foregroundColor(.secondary)
          }
        }
        Spacer(minLength: 6)
        VStack(alignment: .trailing, spacing: 2) {
          Text("Best: \(s.best) \(s.best == 1 ? "day" : "days")").font(.caption).foregroundColor(.secondary)
          Text("\(workoutDays) \(workoutDays == 1 ? "workout" : "workouts") · 12 weeks").font(.caption).foregroundColor(.secondary)
        }
      }
      // Rows are weekdays (labelled from the first week), columns are weeks; today is bottom right.
      HStack(alignment: .top, spacing: 6) {
        VStack(spacing: 5) {
          ForEach(Array((weeks.first ?? []).enumerated()), id: \.offset) { item in
            Text(item.element.letter).font(.system(size: 9, weight: .medium)).foregroundColor(.secondary).frame(height: 15)
          }
        }
        HStack(spacing: 5) {
          ForEach(Array(weeks.enumerated()), id: \.offset) { week in
            VStack(spacing: 5) {
              ForEach(Array(week.element.enumerated()), id: \.offset) { item in
                square(item.element)
              }
            }
            .frame(maxWidth: .infinity)
          }
        }
      }
      HStack {
        Text("12 weeks ago").font(.caption2).foregroundColor(.secondary)
        Spacer()
        Text("Today").font(.caption2).foregroundColor(.secondary)
      }
      Spacer(minLength: 0)
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
    .frame(width: 15, height: 15)
  }
}
