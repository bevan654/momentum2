import ActivityKit
import SwiftUI
import WidgetKit

// The workout Live Activity: the Lock Screen card (WorkoutLockScreen.swift) and the Dynamic Island.
// Expanded (long-press): the Lock Screen card, with its header split into the top corners beside
// the camera and the same buttons (iOS 17+). Compact: dumbbell + workout time, or timer + rest
// countdown. Minimal (when another app's activity shares the Island): a rest ring or a dumbbell.
// Everything uses the user's accent. A rest that ran out while the app was asleep counts as over:
// the system marks the activity stale at the rest's end (staleDate).

private let appURL = URL(string: "momentum://workout")

/// Counts up from the workout start for as long as the activity lives.
private struct ElapsedTimer: View {
  let state: WorkoutActivityAttributes.ContentState

  var body: some View {
    Text(timerInterval: state.workoutStartedAt...Date.distantFuture, countsDown: false)
      .monospacedDigit()
      .foregroundColor(.white)
      .multilineTextAlignment(.trailing)
      .frame(width: 58, alignment: .trailing)
  }
}

struct WorkoutLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
      WorkoutLockScreenView(state: context.state, isStale: context.isStale)
        .activityBackgroundTint(Color.black.opacity(0.92))
        .activitySystemActionForegroundColor(context.state.activityTint)
        .widgetURL(appURL)
    } dynamicIsland: { context in
      let state = context.state
      let tint = state.activityTint
      let rest = state.liveRest(isStale: context.isStale)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          WorkoutIslandTitle(state: state)
        }
        DynamicIslandExpandedRegion(.trailing) {
          WorkoutIslandProgress(state: state)
        }
        DynamicIslandExpandedRegion(.bottom) {
          WorkoutIslandBody(state: state, isStale: context.isStale)
        }
      } compactLeading: {
        Image(systemName: rest == nil ? "dumbbell.fill" : "timer")
          .foregroundColor(tint)
      } compactTrailing: {
        if let rest {
          Text(timerInterval: rest, countsDown: true)
            .monospacedDigit()
            .foregroundColor(tint)
            .multilineTextAlignment(.trailing)
            .frame(width: 44, alignment: .trailing)
        } else {
          ElapsedTimer(state: state)
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
          .tint(tint)
        } else {
          Image(systemName: "dumbbell.fill")
            .foregroundColor(tint)
        }
      }
      .widgetURL(appURL)
      .keylineTint(tint)
    }
  }
}
