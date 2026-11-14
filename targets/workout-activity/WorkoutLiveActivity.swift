import ActivityKit
import SwiftUI
import WidgetKit

// The extension can't read the app's theme tokens, so it uses the app's default
// accent (#FF3232) on the dark palette (#000000 / #8E8E93).
private let accent = Color(red: 1.0, green: 50.0 / 255.0, blue: 50.0 / 255.0)
private let secondaryText = Color(red: 142.0 / 255.0, green: 142.0 / 255.0, blue: 147.0 / 255.0)
private let trackColor = Color(red: 28.0 / 255.0, green: 28.0 / 255.0, blue: 30.0 / 255.0)
private let appURL = URL(string: "momentum://workout")

private extension WorkoutActivityAttributes.ContentState {
  /// The current rest (original start ... end), or nil when not resting.
  var restInterval: ClosedRange<Date>? {
    guard let start = restStartedAt, let end = restEndsAt, end > start else { return nil }
    return start...end
  }

  /// Counts up from the workout start for as long as the activity lives.
  var elapsedInterval: ClosedRange<Date> {
    workoutStartedAt...Date.distantFuture
  }

  var exerciseLine: String {
    if exerciseName.isEmpty { return "Workout in progress" }
    if setCount > 0 { return "\(exerciseName) · Set \(setIndex)/\(setCount)" }
    return exerciseName
  }
}

// MARK: - Pieces

private struct ElapsedTimer: View {
  let state: WorkoutActivityAttributes.ContentState
  var font: Font = .subheadline.weight(.semibold)
  var color: Color = .white
  var width: CGFloat = 72

  var body: some View {
    Text(timerInterval: state.elapsedInterval, countsDown: false)
      .font(font)
      .monospacedDigit()
      .foregroundColor(color)
      .multilineTextAlignment(.trailing)
      .frame(width: width, alignment: .trailing)
  }
}

/// "Rest 1:23" plus a draining bar. JS can't update the activity while the app is
/// in the background, so when the rest runs out this keeps showing: the timer stops
/// at 0:00 and the bar is empty, which reads as "rest is over" on its own. If the
/// system marks the activity stale (staleDate = rest end), the label says so too.
private struct RestRow: View {
  let rest: ClosedRange<Date>
  let isStale: Bool

  var body: some View {
    VStack(spacing: 6) {
      HStack(alignment: .firstTextBaseline) {
        Image(systemName: "timer")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(accent)
        Text(isStale ? "Rest over" : "Rest")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(accent)
        Spacer(minLength: 8)
        Text(timerInterval: rest, countsDown: true)
          .font(.title3.weight(.bold))
          .monospacedDigit()
          .foregroundColor(.white)
          .multilineTextAlignment(.trailing)
          .frame(width: 80, alignment: .trailing)
      }
      ProgressView(
        timerInterval: rest,
        countsDown: true,
        label: { EmptyView() },
        currentValueLabel: { EmptyView() }
      )
      .progressViewStyle(.linear)
      .tint(accent)
      .background(trackColor.clipShape(Capsule()))
    }
  }
}

private struct ExerciseLines: View {
  let state: WorkoutActivityAttributes.ContentState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(state.exerciseLine)
        .font(.headline)
        .foregroundColor(.white)
        .lineLimit(1)
      if let next = state.nextExerciseName, !next.isEmpty {
        Text("Next: \(next)")
          .font(.footnote)
          .foregroundColor(secondaryText)
          .lineLimit(1)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Lock Screen / banner

private struct LockScreenView: View {
  let state: WorkoutActivityAttributes.ContentState
  let isStale: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 6) {
        Image(systemName: "dumbbell.fill")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(accent)
        Text("Momentum")
          .font(.subheadline.weight(.semibold))
          .foregroundColor(secondaryText)
        Spacer(minLength: 8)
        ElapsedTimer(state: state, color: secondaryText)
      }
      ExerciseLines(state: state)
      if let rest = state.restInterval {
        RestRow(rest: rest, isStale: isStale)
      }
    }
    .padding(16)
  }
}

// MARK: - Widget

struct WorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
      LockScreenView(state: context.state, isStale: context.isStale)
        .activityBackgroundTint(Color.black.opacity(0.92))
        .activitySystemActionForegroundColor(accent)
        .widgetURL(appURL)
    } dynamicIsland: { context in
      let state = context.state
      let rest = state.restInterval
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            Image(systemName: "dumbbell.fill")
              .foregroundColor(accent)
            Text("Workout")
              .font(.subheadline.weight(.semibold))
              .foregroundColor(.white)
          }
          .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          ElapsedTimer(state: state, color: secondaryText)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 8) {
            ExerciseLines(state: state)
            if let rest {
              RestRow(rest: rest, isStale: context.isStale)
            }
          }
          .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: rest == nil ? "dumbbell.fill" : "timer")
          .foregroundColor(accent)
      } compactTrailing: {
        if let rest {
          Text(timerInterval: rest, countsDown: true)
            .monospacedDigit()
            .foregroundColor(accent)
            .multilineTextAlignment(.trailing)
            .frame(width: 44, alignment: .trailing)
        } else {
          ElapsedTimer(state: state, font: .body, color: .white, width: 58)
        }
      } minimal: {
        if let rest {
          ProgressView(
            timerInterval: rest,
            countsDown: true,
            label: { EmptyView() },
            currentValueLabel: {
              Image(systemName: "timer").font(.caption2)
            }
          )
          .progressViewStyle(.circular)
          .tint(accent)
        } else {
          Image(systemName: "dumbbell.fill")
            .foregroundColor(accent)
        }
      }
      .widgetURL(appURL)
      .keylineTint(accent)
    }
  }
}
