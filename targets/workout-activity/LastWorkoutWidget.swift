import SwiftUI
import WidgetKit

// The Last workout widget (medium and large). It shows the latest workout against the previous
// time the same workout was done (same routine, same program day, or most of the same exercises;
// src/services/homeWidgets.ts picks it). Medium: the muscles, volume, PRs, time and sets, and the
// heaviest lift. Large adds each exercise's heaviest set, the volume over the same workout's last
// sessions and the next planned workout. Tapping opens that workout's summary; the "Next" row
// opens Workouts.

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

/// "1h 04m", "48m".
private func durationText(_ seconds: Double) -> String {
  let minutes = Int((seconds / 60).rounded())
  return minutes >= 60 ? String(format: "%dh %02dm", minutes / 60, minutes % 60) : "\(minutes)m"
}

/// The next planned workout: today's when nothing was trained today, else the next day with one.
private struct NextPlanned {
  let name: String
  /// Other workouts planned for the same day.
  let others: Int
  /// "today", "tomorrow", "Thursday".
  let when: String

  init?(plan: [HomeWidgetData.PlannedDay], trainedToday: Bool, now: Date) {
    let calendar = Calendar.autoupdatingCurrent
    // Calendar weekdays are 1 = Sunday … 7 = Saturday; the plan's are 0 = Monday … 6 = Sunday.
    let today = (calendar.component(.weekday, from: now) + 5) % 7
    for offset in (trainedToday ? 1 : 0)...7 {
      let names = plan.filter { $0.day == (today + offset) % 7 }.map(\.name)
      guard let first = names.first else { continue }
      name = first
      others = names.count - 1
      switch offset {
      case 0: when = "today"
      case 1: when = "tomorrow"
      default:
        let f = DateFormatter()
        f.setLocalizedDateFormatFromTemplate("EEEE")
        when = f.string(from: calendar.date(byAdding: .day, value: offset, to: now) ?? now)
      }
      return
    }
    return nil
  }
}

struct LastWorkoutWidgetView: View {
  let entry: HomeWidgetEntry
  @Environment(\.widgetFamily) private var family

  var body: some View {
    let section = entry.data?.lastWorkout
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: section != nil) {
        HomeWidgetMessage(symbol: "dumbbell.fill", title: "Last workout", tint: tint, message: message)
      } else if let w = section?.latest {
        if family == .systemLarge { large(w) } else { medium(w) }
      } else {
        HomeWidgetMessage(symbol: "dumbbell.fill", title: "Last workout", tint: tint, message: "Finish a workout to see it here")
      }
    }
    .homeWidgetBackground()
    .widgetURL(section?.latest.flatMap { HomeWidgetLink.workout($0.id) } ?? HomeWidgetLink.workouts)
  }

  private var tint: Color { HomeWidgetColor.accent(entry.data?.accentHex) }

  // MARK: Sizes

  @ViewBuilder
  private func medium(_ w: HomeWidgetData.LastWorkout) -> some View {
    // The heaviest lift (the first of equals, in workout order).
    let top = (w.exercises ?? []).reduce(nil as HomeWidgetData.ExerciseBest?) { best, e in
      best.map { e.kg > $0.kg ? e : $0 } ?? e
    }
    VStack(alignment: .leading, spacing: 0) {
      header(w)
      Spacer(minLength: 2)
      stats(w)
      if let top {
        Divider().padding(.vertical, 4)
        ExerciseBestRow(exercise: top, compared: w.previous != nil)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  @ViewBuilder
  private func large(_ w: HomeWidgetData.LastWorkout) -> some View {
    let exercises = w.exercises ?? []
    let trend = (w.trend?.count ?? 0) >= 2 ? (w.trend ?? []) : []
    let trainedToday = HomeWidgetDay.days(from: Date(timeIntervalSince1970: w.at / 1000), to: entry.date) == 0
    let next = entry.data?.plan.flatMap { NextPlanned(plan: $0, trainedToday: trainedToday, now: entry.date) }
    // Sized for the large widget on every iPhone, the SE's (about 292 pt) included.
    let limit = !trend.isEmpty ? 3 : (next == nil ? 6 : 5)
    VStack(alignment: .leading, spacing: 0) {
      header(w)
      stats(w).padding(.top, 6)
      if !exercises.isEmpty {
        Divider().padding(.vertical, 6)
        Text(w.previous != nil ? "Heaviest set vs last time" : "Heaviest sets")
          .font(.caption2.weight(.semibold)).foregroundColor(.secondary).padding(.bottom, 3)
        VStack(spacing: 4) {
          ForEach(Array(exercises.prefix(limit).enumerated()), id: \.offset) { item in
            ExerciseBestRow(exercise: item.element, compared: w.previous != nil)
          }
        }
        if exercises.count > limit {
          Text("+\(exercises.count - limit) more").font(.caption2).foregroundColor(.secondary).padding(.top, 2)
        }
      }
      if !trend.isEmpty {
        Divider().padding(.vertical, 6)
        Text("Volume · last \(trend.count) sessions")
          .font(.caption2.weight(.semibold)).foregroundColor(.secondary).padding(.bottom, 4)
        VolumeTrend(values: trend, tint: tint).frame(height: 44)
      }
      Spacer(minLength: 0)
      if let next {
        Divider().padding(.vertical, 6)
        nextRow(next)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  // MARK: Parts

  /// "Last workout · Yesterday   vs Mon 10 Nov" over the title and the muscles worked.
  private func header(_ w: HomeWidgetData.LastWorkout) -> some View {
    // A title made from the muscles ("Chest & Triceps") doesn't repeat them.
    let muscles = (w.muscles ?? []).filter { !w.title.localizedCaseInsensitiveContains($0) }
    return VStack(alignment: .leading, spacing: 2) {
      HStack {
        HomeWidgetTitle(symbol: "dumbbell.fill", text: "Last workout · \(dayText(w.at, now: entry.date))", tint: tint)
        Spacer(minLength: 6)
        if let previous = w.previous {
          Text("vs \(dayText(previous.at, now: entry.date))").font(.caption2).foregroundColor(.secondary).lineLimit(1)
        }
      }
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Text(w.title).font(.title3.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7).layoutPriority(1)
        if !muscles.isEmpty {
          Text(muscles.joined(separator: " · ")).font(.caption).foregroundColor(.secondary).lineLimit(1)
        }
      }
      .padding(.top, 2)
    }
  }

  /// Volume (and its change), PRs, time and sets; time and sets only when recorded.
  private func stats(_ w: HomeWidgetData.LastWorkout) -> some View {
    HStack(alignment: .top, spacing: 16) {
      VStack(alignment: .leading, spacing: 1) {
        Text("Volume").font(.caption2).foregroundColor(.secondary)
        Text(kgText(w.volume)).font(.headline).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
        volumeChange(w)
      }
      VStack(alignment: .leading, spacing: 1) {
        Text("PRs").font(.caption2).foregroundColor(.secondary)
        Label("\(w.prs)", systemImage: "crown.fill")
          .font(.headline)
          .foregroundColor(w.prs > 0 ? HomeWidgetColor.gold : .primary)
          .monospacedDigit()
          .lineLimit(1)
      }
      if let duration = w.duration, duration > 0 {
        stat("Time", durationText(duration))
      }
      if let sets = w.sets, sets > 0 {
        stat("Sets", "\(sets)")
      }
      Spacer(minLength: 0)
    }
  }

  private func stat(_ label: String, _ value: String) -> some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(label).font(.caption2).foregroundColor(.secondary)
      Text(value).font(.headline).monospacedDigit().lineLimit(1).minimumScaleFactor(0.7)
    }
  }

  @ViewBuilder
  private func volumeChange(_ w: HomeWidgetData.LastWorkout) -> some View {
    if let previous = w.previous {
      let change = (w.volume - previous.volume).rounded()
      if change > 0 {
        Text("+\(kgText(change))").font(.caption.weight(.semibold)).monospacedDigit().foregroundColor(HomeWidgetColor.green).lineLimit(1)
      } else if change < 0 {
        Text("−\(kgText(-change))").font(.caption.weight(.semibold)).monospacedDigit().foregroundColor(HomeWidgetColor.red).lineLimit(1)
      } else {
        Text("Same as last time").font(.caption).foregroundColor(.secondary).lineLimit(1)
      }
    } else {
      Text(w.firstTime == true ? "First time" : "Nothing to compare").font(.caption).foregroundColor(.secondary).lineLimit(1)
    }
  }

  /// "Next: Pull day · today ›", opening Workouts.
  @ViewBuilder
  private func nextRow(_ next: NextPlanned) -> some View {
    let row = HStack(spacing: 4) {
      (Text("Next: ").foregroundColor(.secondary)
        + Text(next.name).fontWeight(.semibold)
        + Text(next.others > 0 ? " +\(next.others)" : "").foregroundColor(.secondary)
        + Text(" · \(next.when)").foregroundColor(.secondary))
        .font(.caption)
        .lineLimit(1)
      Spacer(minLength: 4)
      Image(systemName: "chevron.right").font(.caption2.weight(.semibold)).foregroundColor(.secondary)
    }
    if let url = HomeWidgetLink.workouts {
      Link(destination: url) { row }
    } else {
      row
    }
  }
}

/// "Bench press   82.5 kg × 8  +2.5 kg": an exercise's heaviest set, and the change since last time.
private struct ExerciseBestRow: View {
  let exercise: HomeWidgetData.ExerciseBest
  /// There's an earlier session to compare with (else no changes are shown).
  let compared: Bool

  var body: some View {
    HStack(spacing: 6) {
      Text(exercise.name).font(.caption.weight(.semibold)).lineLimit(1)
      Spacer(minLength: 4)
      Text(setText).font(.caption).monospacedDigit().lineLimit(1)
      if compared { change.font(.caption2.weight(.semibold)).monospacedDigit().lineLimit(1) }
    }
  }

  private var setText: String {
    let e = exercise
    if e.kind == "duration" { return WorkoutSetMath.secondsText(e.reps) }
    return e.kg > 0 ? "\(WorkoutSetMath.kgText(e.kg)) × \(e.reps)" : "\(e.reps) reps"
  }

  @ViewBuilder
  private var change: some View {
    let e = exercise
    if let lastKg = e.previousKg, let lastReps = e.previousReps {
      let kgChange = e.kg - lastKg
      if abs(kgChange) >= 0.01 {
        Text("\(kgChange > 0 ? "+" : "−")\(WorkoutSetMath.kgText(abs(kgChange))) kg")
          .foregroundColor(kgChange > 0 ? HomeWidgetColor.green : HomeWidgetColor.red)
      } else if e.reps != lastReps {
        let d = e.reps - lastReps
        let unit = e.kind == "duration" ? "s" : (abs(d) == 1 ? "rep" : "reps")
        Text("\(d > 0 ? "+" : "−")\(abs(d)) \(unit)")
          .foregroundColor(d > 0 ? HomeWidgetColor.green : HomeWidgetColor.red)
      } else {
        Text("same").foregroundColor(.secondary)
      }
    } else {
      Text("new").foregroundColor(.secondary)
    }
  }
}

/// One bar per session, oldest first; the latest in the accent. Bars start from 70% of the lowest
/// value, so the differences between similar sessions show.
private struct VolumeTrend: View {
  let values: [Double]
  let tint: Color

  var body: some View {
    let top = values.max() ?? 0
    let floor = (values.min() ?? 0) * 0.7
    VStack(spacing: 2) {
      GeometryReader { geo in
        HStack(alignment: .bottom, spacing: 6) {
          ForEach(Array(values.enumerated()), id: \.offset) { item in
            let fraction = top > floor ? (item.element - floor) / (top - floor) : 1
            RoundedRectangle(cornerRadius: 3, style: .continuous)
              .fill(item.offset == values.count - 1 ? tint : Color.primary.opacity(0.18))
              .frame(height: max(4, geo.size.height * fraction))
              .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
              .widgetAccentable(item.offset == values.count - 1)
          }
        }
      }
      HStack {
        Text(kgText(values.first ?? 0))
        Spacer(minLength: 4)
        Text(kgText(values.last ?? 0))
      }
      .font(.caption2)
      .monospacedDigit()
      .foregroundColor(.secondary)
    }
  }
}

struct LastWorkoutWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumLastWorkout", provider: HomeWidgetProvider()) { LastWorkoutWidgetView(entry: $0) }
      .configurationDisplayName("Last workout")
      .description("Your latest workout against the previous time: volume, PRs, time, sets and your heaviest lift. The large size adds every lift, your volume trend and what's next.")
      .supportedFamilies([.systemMedium, .systemLarge])
  }
}
