import SwiftUI
import WidgetKit

// Small home screen widgets for today's food: Calories (ring), Protein, Macros. Each opens the
// Nutrition tab. Totals from another day count as nothing eaten yet (the day rolled over and the app
// hasn't written today's), so they reset at midnight on their own.

private extension HomeWidgetData.Nutrition {
  /// Today's totals, or zeros (goals kept) when these are from another day.
  func on(_ date: Date) -> HomeWidgetData.Nutrition {
    guard self.date != HomeWidgetDay.key(date) else { return self }
    var n = self
    n.kcal = 0
    n.protein = 0
    n.carbs = 0
    n.fat = 0
    return n
  }
}

func nutritionGoal(_ value: Double?) -> Double? {
  guard let value, value > 0 else { return nil }
  return value
}

func grams(_ value: Double) -> String { "\(Int(value.rounded())) g" }

func kcalText(_ value: Double) -> String {
  let f = NumberFormatter()
  f.numberStyle = .decimal
  f.maximumFractionDigits = 0
  return f.string(from: NSNumber(value: value.rounded())) ?? "\(Int(value.rounded()))"
}

/// Calories colour, as the app's calorie ring: accent, orange from 90%, red when over.
func calorieColor(eaten: Double, goal: Double, accent: Color) -> Color {
  if eaten > goal { return HomeWidgetColor.red }
  return eaten / goal >= 0.9 ? HomeWidgetColor.orange : accent
}

func nutritionOf(_ entry: HomeWidgetEntry) -> HomeWidgetData.Nutrition {
  entry.data?.nutrition?.on(entry.date)
    ?? HomeWidgetData.Nutrition(date: HomeWidgetDay.key(entry.date), kcal: 0, protein: 0, carbs: 0, fat: 0)
}

// MARK: - A · Calories

struct CaloriesWidgetView: View {
  let entry: HomeWidgetEntry

  var body: some View {
    let accent = HomeWidgetColor.accent(entry.data?.accentHex)
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: entry.data?.nutrition != nil) {
        HomeWidgetMessage(symbol: "flame.fill", title: "Calories", tint: accent, message: message)
      } else {
        content(nutritionOf(entry), accent: accent)
      }
    }
    .homeWidgetBackground()
    .widgetURL(HomeWidgetLink.nutrition)
  }

  @ViewBuilder
  private func content(_ n: HomeWidgetData.Nutrition, accent: Color) -> some View {
    VStack(spacing: 4) {
      HomeWidgetTitle(symbol: "flame.fill", text: "Calories", tint: accent)
        .frame(maxWidth: .infinity, alignment: .leading)
      if let target = nutritionGoal(n.goalKcal) {
        CalorieRingView(eaten: n.kcal, goal: target, accent: accent)
          .padding(.horizontal, 10)
          .frame(maxHeight: .infinity)
        Text("\(kcalText(n.kcal)) / \(kcalText(target))")
          .font(.caption2)
          .monospacedDigit()
          .foregroundColor(.secondary)
      } else {
        NoGoalView(value: "\(kcalText(n.kcal))", unit: "kcal eaten")
      }
    }
  }
}

/// The calorie ring with "920 kcal left" (or "120 kcal over" in red) in the middle.
struct CalorieRingView: View {
  let eaten: Double
  let goal: Double
  let accent: Color

  var body: some View {
    let over = eaten > goal
    ZStack {
      Circle().stroke(Color.primary.opacity(0.12), lineWidth: 9)
      Circle()
        .trim(from: 0, to: min(eaten / goal, 1))
        .stroke(calorieColor(eaten: eaten, goal: goal, accent: accent), style: StrokeStyle(lineWidth: 9, lineCap: .round))
        .rotationEffect(.degrees(-90))
        .widgetAccentable()
      VStack(spacing: 0) {
        Text(kcalText(over ? eaten - goal : goal - eaten))
          .font(.title2.weight(.bold))
          .monospacedDigit()
          .foregroundColor(over ? HomeWidgetColor.red : .primary)
          .minimumScaleFactor(0.6)
          .lineLimit(1)
        Text(over ? "kcal over" : "kcal left")
          .font(.caption2.weight(.medium))
          .foregroundColor(over ? HomeWidgetColor.red : .secondary)
      }
      .padding(.horizontal, 12)
    }
  }
}

/// "1,580 kcal eaten" + "Set a goal in Momentum".
struct NoGoalView: View {
  let value: String
  let unit: String

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Spacer(minLength: 0)
      Text(value).font(.title.weight(.bold)).monospacedDigit().lineLimit(1).minimumScaleFactor(0.6)
      Text(unit).font(.caption).foregroundColor(.secondary)
      Spacer(minLength: 0)
      Text("Set a goal in Momentum").font(.caption2).foregroundColor(.secondary).lineLimit(2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - B · Protein

struct ProteinWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: entry.data?.nutrition != nil) {
        HomeWidgetMessage(symbol: "fork.knife", title: "Protein", tint: HomeWidgetColor.protein, message: message)
      } else if family == .systemMedium {
        ProteinMediumView(n: nutritionOf(entry))
      } else {
        content(nutritionOf(entry))
      }
    }
    .homeWidgetBackground()
    .widgetURL(HomeWidgetLink.nutrition)
  }

  @ViewBuilder
  private func content(_ n: HomeWidgetData.Nutrition) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HomeWidgetTitle(symbol: "fork.knife", text: "Protein", tint: HomeWidgetColor.protein)
      if let target = nutritionGoal(n.goalProtein) {
        Spacer(minLength: 0)
        (Text("\(Int(n.protein.rounded()))").font(.largeTitle.weight(.bold))
          + Text(" g").font(.headline).foregroundColor(.secondary))
          .monospacedDigit()
          .lineLimit(1)
          .minimumScaleFactor(0.6)
        if n.protein >= target {
          Label("Goal hit", systemImage: "checkmark")
            .font(.caption.weight(.semibold))
            .foregroundColor(HomeWidgetColor.protein)
        } else {
          Text("of \(grams(target)) · \(grams(target - n.protein)) to go")
            .font(.caption)
            .foregroundColor(.secondary)
            .lineLimit(1)
            .minimumScaleFactor(0.8)
        }
        Spacer(minLength: 0)
        HomeWidgetBar(fraction: n.protein / target, color: HomeWidgetColor.protein)
      } else {
        NoGoalView(value: grams(n.protein), unit: "protein eaten")
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - C · Macros

struct MacrosWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(.widgetFamily) private var family

  var body: some View {
    let accent = HomeWidgetColor.accent(entry.data?.accentHex)
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: entry.data?.nutrition != nil) {
        HomeWidgetMessage(symbol: "chart.bar.fill", title: "Macros", tint: accent, message: message)
      } else if family == .systemMedium {
        MacrosMediumView(n: nutritionOf(entry), accent: accent)
      } else {
        content(nutritionOf(entry), accent: accent)
      }
    }
    .homeWidgetBackground()
    .widgetURL(HomeWidgetLink.nutrition)
  }

  @ViewBuilder
  private func content(_ n: HomeWidgetData.Nutrition, accent: Color) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      HomeWidgetTitle(symbol: "chart.bar.fill", text: "Macros", tint: accent)
      if let target = nutritionGoal(n.goalKcal) {
        let over = n.kcal > target
        (Text(kcalText(over ? n.kcal - target : target - n.kcal)).font(.title2.weight(.bold))
          + Text(over ? " kcal over" : " kcal left").font(.caption).foregroundColor(over ? HomeWidgetColor.red : .secondary))
          .monospacedDigit()
          .foregroundColor(over ? HomeWidgetColor.red : .primary)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      } else {
        (Text(kcalText(n.kcal)).font(.title2.weight(.bold)) + Text(" kcal").font(.caption).foregroundColor(.secondary))
          .monospacedDigit()
          .lineLimit(1)
      }
      Spacer(minLength: 4)
      VStack(spacing: 5) {
        MacroRow(name: "Protein", eaten: n.protein, goal: nutritionGoal(n.goalProtein), color: HomeWidgetColor.protein)
        MacroRow(name: "Carbs", eaten: n.carbs, goal: nutritionGoal(n.goalCarbs), color: HomeWidgetColor.carbs)
        MacroRow(name: "Fat", eaten: n.fat, goal: nutritionGoal(n.goalFat), color: HomeWidgetColor.fat)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

/// "Protein   38 g left" over a bar; "12 g over" in red when over; grams eaten without a goal.
struct MacroRow: View {
  let name: String
  let eaten: Double
  let goal: Double?
  let color: Color
  /// "142 / 180 g" (medium) instead of "38 g left"; red when over.
  var showsTotal = false

  var body: some View {
    VStack(spacing: 2) {
      HStack {
        Text(name).font(.caption2.weight(.semibold)).foregroundColor(.primary)
        Spacer(minLength: 4)
        detail.font(.caption2).monospacedDigit().lineLimit(1)
      }
      HomeWidgetBar(fraction: goal.map { eaten / $0 } ?? 0, color: color)
    }
  }

  @ViewBuilder
  private var detail: some View {
    if let goal, showsTotal {
      Text("(Int(eaten.rounded())) / (grams(goal))").foregroundColor(eaten > goal ? HomeWidgetColor.red : .secondary)
    } else if let goal {
      if eaten > goal {
        Text("\(grams(eaten - goal)) over").foregroundColor(HomeWidgetColor.red)
      } else {
        Text("\(grams(goal - eaten)) left").foregroundColor(.secondary)
      }
    } else {
      Text(grams(eaten)).foregroundColor(.secondary)
    }
  }
}

// MARK: - Widgets

struct CaloriesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumCalories", provider: HomeWidgetProvider()) { CaloriesWidgetView(entry: $0) }
      .configurationDisplayName("Calories")
      .description("Calories left today against your goal.")
      .supportedFamilies([.systemSmall])
  }
}

struct ProteinWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumProtein", provider: HomeWidgetProvider()) { ProteinWidgetView(entry: $0) }
      .configurationDisplayName("Protein")
      .description("Protein eaten today, how much is left to your goal and, at medium size, per meal.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

struct MacrosWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumMacros", provider: HomeWidgetProvider()) { MacrosWidgetView(entry: $0) }
      .configurationDisplayName("Macros")
      .description("Calories, protein, carbs and fat today against your goals.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}
