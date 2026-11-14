import ActivityKit
import ExpoModulesCore

/// What JS sends; times are epoch milliseconds. Mirrors `WorkoutLiveActivityState` in index.ts.
struct WorkoutLiveActivityState: Record {
  @Field var workoutStartedAt: Double = 0
  @Field var exerciseName: String = ""
  @Field var setIndex: Int = 0
  @Field var setCount: Int = 0
  @Field var nextExerciseName: String? = nil
  @Field var restStartedAt: Double? = nil
  @Field var restEndsAt: Double? = nil
}

public class WorkoutLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WorkoutLiveActivity")

    Function("isSupported") { () -> Bool in
      guard #available(iOS 16.2, *) else { return false }
      return ActivityAuthorizationInfo().areActivitiesEnabled
    }

    AsyncFunction("start") { (state: WorkoutLiveActivityState) async throws -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      return try await WorkoutActivityController.start(state)
    }

    AsyncFunction("update") { (state: WorkoutLiveActivityState) async in
      guard #available(iOS 16.2, *) else { return }
      await WorkoutActivityController.update(state)
    }

    // There's only ever one workout activity, so `end` and `endAll` are the same here.
    AsyncFunction("end") { () async in
      guard #available(iOS 16.2, *) else { return }
      await WorkoutActivityController.endAll()
    }

    AsyncFunction("endAll") { () async in
      guard #available(iOS 16.2, *) else { return }
      await WorkoutActivityController.endAll()
    }
  }
}

@available(iOS 16.2, *)
private enum WorkoutActivityController {
  typealias Attributes = WorkoutActivityAttributes

  /// Activities that are still showing (ended ones can linger in `activities`).
  static var live: [Activity<Attributes>] {
    Activity<Attributes>.activities.filter { $0.activityState == .active || $0.activityState == .stale }
  }

  static func date(_ ms: Double?) -> Date? {
    guard let ms, ms > 0 else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
  }

  static func content(_ s: WorkoutLiveActivityState) -> ActivityContent<Attributes.ContentState> {
    let restEndsAt = date(s.restEndsAt)
    let state = Attributes.ContentState(
      workoutStartedAt: date(s.workoutStartedAt) ?? Date(),
      exerciseName: s.exerciseName,
      setIndex: s.setIndex,
      setCount: s.setCount,
      nextExerciseName: s.nextExerciseName,
      restStartedAt: restEndsAt == nil ? nil : date(s.restStartedAt),
      restEndsAt: restEndsAt
    )
    // Stale at the rest's end, so the widget can say "Rest over" if the system
    // re-renders it then (JS can't update it from the background).
    return ActivityContent(state: state, staleDate: restEndsAt)
  }

  /// Adopts an activity left from a previous launch (the app was killed mid-workout)
  /// instead of stacking a second one.
  static func start(_ s: WorkoutLiveActivityState) async throws -> String? {
    let content = content(s)
    let existing = live
    if let current = existing.first {
      for extra in existing.dropFirst() {
        await extra.end(nil, dismissalPolicy: .immediate)
      }
      await current.update(content)
      return current.id
    }
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
    let activity = try Activity.request(attributes: Attributes(), content: content, pushType: nil)
    return activity.id
  }

  /// Only updates a running activity: one the user dismissed stays dismissed.
  static func update(_ s: WorkoutLiveActivityState) async {
    let content = content(s)
    for activity in live {
      await activity.update(content)
    }
  }

  static func endAll() async {
    for activity in Activity<Attributes>.activities {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}
