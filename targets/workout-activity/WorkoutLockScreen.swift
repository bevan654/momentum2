import ActivityKit
import AppIntents
import SwiftUI
import WidgetKit

// The Lock Screen (and banner) view of the workout Live Activity. Two states:
//  - between sets: header, exercise + set dots, big "80 kg × [−] 8 [+]  (✓)", last time / since last set
//  - resting: rest countdown + End rest, bar, "Up next …", and how the set just done compares
// The buttons (iOS 17+) run the intents in WorkoutActivityShared.swift. When a rest runs out while
// the app is asleep, the system marks the activity stale (staleDate = rest end) and this shows the
// between-sets state again.

private let defaultAccent = Color(red: 1.0, green: 50.0 / 255.0, blue: 50.0 / 255.0)
private let secondaryText = Color(red: 142.0 / 255.0, green: 142.0 / 255.0, blue: 147.0 / 255.0)
private let trackColor = Color(red: 28.0 / 255.0, green: 28.0 / 255.0, blue: 30.0 / 255.0)
private let controlFill = Color(red: 31.0 / 255.0, green: 31.0 / 255.0, blue: 34.0 / 255.0)
private let statFill = Color(red: 21.0 / 255.0, green: 21.0 / 255.0, blue: 24.0 / 255.0)
private let upColor = Color(red: 52.0 / 255.0, green: 211.0 / 255.0, blue: 153.0 / 255.0)
private let downColor = Color(red: 1.0, green: 107.0 / 255.0, blue: 107.0 / 255.0)
private let prGold = Color(red: 245.0 / 255.0, green: 183.0 / 255.0, blue: 0.0)
private let prInk = Color(red: 26.0 / 255.0, green: 19.0 / 255.0, blue: 0.0)

/// "#RRGGBB" → Color; nil if it doesn't parse.
private func color(hex: String?) -> Color? {
  guard var s = hex?.trimmingCharacters(in: .whitespaces), !s.isEmpty else { return nil }
  if s.hasPrefix("#") { s.removeFirst() }
  guard s.count == 6, let v = UInt32(s, radix: 16) else { return nil }
  return Color(
    red: Double((v >> 16) & 0xFF) / 255.0,
    green: Double((v >> 8) & 0xFF) / 255.0,
    blue: Double(v & 0xFF) / 255.0
  )
}

private extension WorkoutActivityAttributes.ContentState {
  var tint: Color { color(hex: accentHex) ?? defaultAccent }

  var lockRest: ClosedRange<Date>? {
    guard let start = restStartedAt, let end = restEndsAt, end > start else { return nil }
    return start...end
  }

  var setsLeft: Bool {
    guard let total = workoutSets, total > 0 else { return current != nil }
    return (completedSets ?? 0) < total
  }
}

private var buttonsAvailable: Bool {
  if #available(iOS 17.0, *) { return true }
  return false
}

// MARK: - Small pieces

private struct DeltaChip: View {
  let text: String
  let sign: Int

  var body: some View {
    Text(text)
      .font(.caption2.weight(.semibold))
      .foregroundColor(sign > 0 ? upColor : sign < 0 ? downColor : secondaryText)
      .padding(.horizontal, 7)
      .padding(.vertical, 2)
      .background((sign > 0 ? upColor : sign < 0 ? downColor : secondaryText).opacity(0.16).clipShape(Capsule()))
      .lineLimit(1)
      .fixedSize()
  }
}

private struct PRBadge: View {
  var body: some View {
    HStack(spacing: 3) {
      Image(systemName: "crown.fill").font(.caption2.weight(.bold))
      Text("PR").font(.caption2.weight(.heavy))
    }
    .foregroundColor(prInk)
    .padding(.leading, 6)
    .padding(.trailing, 8)
    .padding(.vertical, 2)
    .background(prGold.clipShape(Capsule()))
    .fixedSize()
  }
}

private struct SetDots: View {
  let states: String
  let tint: Color

  var body: some View {
    HStack(spacing: 4) {
      ForEach(Array(states.prefix(10).enumerated()), id: \.offset) { item in
        Capsule()
          .fill(item.element == "d" ? tint : item.element == "c" ? Color.white : trackColor)
          .frame(width: 14, height: 5)
      }
    }
    .fixedSize()
  }
}

/// A filled circle with an SF Symbol: the look of every round button.
private struct CircleIcon: View {
  let symbol: String
  let size: CGFloat
  let fill: Color
  var font: Font = .subheadline.weight(.bold)

  var body: some View {
    Image(systemName: symbol)
      .font(font)
      .foregroundColor(.white)
      .frame(width: size, height: size)
      .background(fill.clipShape(Circle()))
  }
}

/// "80 kg × [−] 8 [+]           (✓)"; the buttons need iOS 17.
private struct BigSetRow: View {
  let card: WorkoutSetCard
  let tint: Color

  var body: some View {
    let adjustable = buttonsAvailable && card.kind != "duration" && card.reps != nil
    HStack(spacing: 8) {
      if let weight = WorkoutSetMath.weightText(kind: card.kind, kg: card.kg) {
        Text("\(weight) ×")
          .font(.title2.weight(.bold))
          .foregroundColor(.white)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
      if card.kind == "duration" {
        Text(card.reps.map { WorkoutSetMath.secondsText($0) } ?? "—")
          .font(.title2.weight(.bold))
          .monospacedDigit()
          .foregroundColor(.white)
      } else {
        if adjustable { repsButton(delta: -1, symbol: "minus") }
        Text(card.reps.map { String($0) } ?? "—")
          .font(.title2.weight(.bold))
          .monospacedDigit()
          .foregroundColor(.white)
          .fixedSize()
        if adjustable { repsButton(delta: 1, symbol: "plus") }
        if card.kind == "bodyweight" {
          Text("reps").font(.subheadline.weight(.semibold)).foregroundColor(secondaryText)
        }
      }
      Spacer(minLength: 4)
      if card.canComplete { doneButton }
    }
  }

  @ViewBuilder
  private var doneButton: some View {
    if #available(iOS 17.0, *) {
      Button(intent: CompleteWorkoutSetIntent(setKey: card.key)) {
        CircleIcon(symbol: "checkmark", size: 44, fill: tint, font: .title3.weight(.bold))
      }
      .buttonStyle(.plain)
    }
  }

  @ViewBuilder
  private func repsButton(delta: Int, symbol: String) -> some View {
    if #available(iOS 17.0, *) {
      Button(intent: AdjustWorkoutRepsIntent(setKey: card.key, delta: delta)) {
        CircleIcon(symbol: symbol, size: 30, fill: controlFill)
      }
      .buttonStyle(.plain)
    }
  }
}

// MARK: - Between sets

private struct BetweenSetsView: View {
  let state: WorkoutActivityAttributes.ContentState
  let tint: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      header
      if let card = state.current {
        HStack(spacing: 8) {
          Text("\(card.exerciseName) · set \(card.setIndex) of \(card.setCount)")
            .font(.headline)
            .foregroundColor(.white)
            .lineLimit(1)
          Spacer(minLength: 4)
          SetDots(states: card.setStates, tint: tint)
        }
        BigSetRow(card: card, tint: tint)
        footer(card)
      } else {
        Text(message)
          .font(.headline)
          .foregroundColor(.white)
          .lineLimit(2)
      }
    }
  }

  private var message: String {
    if state.exerciseName.isEmpty { return "Add an exercise to get started" }
    if state.setsLeft { return "Open Momentum for your next set" }
    return "All sets done"
  }

  private var header: some View {
    HStack(spacing: 6) {
      Image(systemName: "dumbbell.fill")
        .font(.subheadline.weight(.semibold))
        .foregroundColor(tint)
      Text(state.workoutTitle ?? "Workout")
        .font(.subheadline.weight(.semibold))
        .foregroundColor(secondaryText)
        .lineLimit(1)
      Spacer(minLength: 6)
      if let total = state.workoutSets, total > 0 {
        Text("\(min(state.completedSets ?? 0, total))/\(total) sets ·")
          .font(.footnote.weight(.medium))
          .monospacedDigit()
          .foregroundColor(secondaryText)
          .fixedSize()
      }
      Text(timerInterval: state.workoutStartedAt...Date.distantFuture, countsDown: false)
        .font(.footnote.weight(.semibold))
        .monospacedDigit()
        .foregroundColor(secondaryText)
        .multilineTextAlignment(.trailing)
        .frame(width: 56, alignment: .trailing)
    }
  }

  @ViewBuilder
  private func footer(_ card: WorkoutSetCard) -> some View {
    let last = WorkoutSetMath.setText(kind: card.kind, kg: card.lastKg, reps: card.lastReps)
    let delta = WorkoutSetMath.delta(kind: card.kind, kg: card.kg, reps: card.reps, lastKg: card.lastKg, lastReps: card.lastReps)
    if last != nil || state.lastCompletedAt != nil {
      HStack(spacing: 6) {
        if let last {
          Text("Last time \(last)")
            .font(.footnote)
            .foregroundColor(secondaryText)
            .lineLimit(1)
          if let delta { DeltaChip(text: delta.text, sign: delta.sign) }
        }
        Spacer(minLength: 4)
        if let since = state.lastCompletedAt {
          HStack(spacing: 4) {
            Text("Since last set").font(.footnote).foregroundColor(secondaryText)
            Text(timerInterval: since...Date.distantFuture, countsDown: false)
              .font(.footnote.weight(.semibold))
              .monospacedDigit()
              .foregroundColor(.white)
              .frame(width: 40, alignment: .trailing)
          }
          .fixedSize()
        }
      }
    }
  }
}

// MARK: - Resting

private struct RestingView: View {
  let state: WorkoutActivityAttributes.ContentState
  let rest: ClosedRange<Date>
  let tint: Color

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 6) {
        Image(systemName: "timer").font(.subheadline.weight(.semibold)).foregroundColor(tint)
        Text("Rest").font(.subheadline.weight(.semibold)).foregroundColor(tint)
        Text(timerInterval: rest, countsDown: true)
          .font(.title3.weight(.bold))
          .monospacedDigit()
          .foregroundColor(.white)
          .frame(width: 76, alignment: .leading)
        Spacer(minLength: 4)
        if #available(iOS 17.0, *) {
          Button(intent: EndWorkoutRestIntent()) {
            HStack(spacing: 4) {
              Image(systemName: "forward.end.fill").font(.caption.weight(.bold))
              Text("End rest").font(.footnote.weight(.semibold))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 11)
            .padding(.vertical, 6)
            .background(controlFill.clipShape(Capsule()))
          }
          .buttonStyle(.plain)
        }
      }
      ProgressView(timerInterval: rest, countsDown: true, label: { EmptyView() }, currentValueLabel: { EmptyView() })
        .progressViewStyle(.linear)
        .tint(tint)
        .background(trackColor.clipShape(Capsule()))
      upNext
      if let done = state.justDone { DoneStat(done: done, sameExercise: done.exerciseName == state.current?.exerciseName) }
    }
  }

  @ViewBuilder
  private var upNext: some View {
    if let card = state.current {
      (Text("Up next  ").foregroundColor(tint) + Text("\(card.exerciseName) · set \(card.setIndex) of \(card.setCount)").foregroundColor(.white))
        .font(.headline)
        .lineLimit(1)
    } else if !state.setsLeft {
      Text("All sets done").font(.headline).foregroundColor(.white)
    }
  }
}

/// "80 kg × 8 [+1 rep] [PR]" over "Set 2 just now · Heaviest ever · last time 80 kg × 7".
/// Two lines, to stay inside the Lock Screen's height limit.
private struct DoneStat: View {
  let done: WorkoutDoneSet
  let sameExercise: Bool

  var body: some View {
    let text = WorkoutSetMath.setText(kind: done.kind, kg: done.kg, reps: done.reps) ?? "Done"
    let delta = WorkoutSetMath.delta(kind: done.kind, kg: done.kg, reps: done.reps, lastKg: done.lastKg, lastReps: done.lastReps)
    VStack(alignment: .leading, spacing: 3) {
      HStack(spacing: 6) {
        Text(text).font(.headline).foregroundColor(.white).lineLimit(1)
        if let delta { DeltaChip(text: delta.text, sign: delta.sign) }
        if done.prLabel != nil { PRBadge() }
        Spacer(minLength: 0)
      }
      Text(detailLine)
        .font(.caption)
        .foregroundColor(secondaryText)
        .lineLimit(1)
    }
    .padding(.horizontal, 10)
    .padding(.vertical, 7)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(statFill.clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous)))
  }

  private var detailLine: String {
    let which = sameExercise ? "Set \(done.setIndex) just now" : "\(done.exerciseName) · set \(done.setIndex)"
    let last = WorkoutSetMath.setText(kind: done.kind, kg: done.lastKg, reps: done.lastReps).map { "last time \($0)" }
    return [which, done.prLabel, last].compactMap { $0 }.joined(separator: " · ")
  }
}

// MARK: - The Lock Screen view

struct WorkoutLockScreenView: View {
  let state: WorkoutActivityAttributes.ContentState
  let isStale: Bool

  var body: some View {
    let tint = state.tint
    Group {
      // A rest that ran out while the app was asleep: the system marks the activity stale at its end.
      if let rest = state.lockRest, !isStale {
        RestingView(state: state, rest: rest, tint: tint)
      } else {
        BetweenSetsView(state: state, tint: tint)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }
}

extension WorkoutActivityAttributes.ContentState {
  /// The accent for the Lock Screen's system controls.
  var lockScreenTint: Color { tint }
}
