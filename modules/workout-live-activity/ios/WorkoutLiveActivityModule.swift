import ActivityKit
import ExpoModulesCore
import WidgetKit

/// One set on the Lock Screen. Mirrors `WorkoutLiveActivitySetCard` in index.ts.
struct WorkoutSetCardRecord: Record {
  @Field var exerciseId: String = ""
  @Field var exerciseName: String = ""
  @Field var setPosition: Int = 0
  @Field var setIndex: Int = 0
  @Field var setCount: Int = 0
  @Field var kind: String = "weighted"
  @Field var kg: Double? = nil
  @Field var reps: Int? = nil
  @Field var lastKg: Double? = nil
  @Field var lastReps: Int? = nil
  @Field var prKg: Double? = nil
  @Field var prReps: Int? = nil
  @Field var setStates: String = ""

  var card: WorkoutSetCard {
    WorkoutSetCard(
      exerciseId: exerciseId, exerciseName: exerciseName, setPosition: setPosition,
      setIndex: setIndex, setCount: setCount, kind: kind, kg: kg, reps: reps,
      lastKg: lastKg, lastReps: lastReps, prKg: prKg, prReps: prReps, setStates: setStates
    )
  }
}

/// The set just ticked off. Mirrors `WorkoutLiveActivityDoneSet` in index.ts.
struct WorkoutDoneSetRecord: Record {
  @Field var exerciseName: String = ""
  @Field var setIndex: Int = 0
  @Field var kind: String = "weighted"
  @Field var kg: Double? = nil
  @Field var reps: Int? = nil
  @Field var lastKg: Double? = nil
  @Field var lastReps: Int? = nil
  @Field var prLabel: String? = nil

  var doneSet: WorkoutDoneSet {
    WorkoutDoneSet(
      exerciseName: exerciseName, setIndex: setIndex, kind: kind, kg: kg, reps: reps,
      lastKg: lastKg, lastReps: lastReps, prLabel: prLabel
    )
  }
}

/// What JS sends; times are epoch milliseconds. Mirrors `WorkoutLiveActivityState` in index.ts.
struct WorkoutLiveActivityState: Record {
  @Field var workoutStartedAt: Double = 0
  @Field var exerciseName: String = ""
  @Field var setIndex: Int = 0
  @Field var setCount: Int = 0
  @Field var nextExerciseName: String? = nil
  @Field var restStartedAt: Double? = nil
  @Field var restEndsAt: Double? = nil
  // Lock Screen (1.0.38+).
  @Field var workoutId: String? = nil
  @Field var workoutTitle: String? = nil
  @Field var completedSets: Int = 0
  @Field var workoutSets: Int = 0
  @Field var accentHex: String? = nil
  @Field var restSeconds: Int = 0
  @Field var lastCompletedAt: Double? = nil
  @Field var current: WorkoutSetCardRecord? = nil
  @Field var after: WorkoutSetCardRecord? = nil
  @Field var justDone: WorkoutDoneSetRecord? = nil
}

public class WorkoutLiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WorkoutLiveActivity")

    // A Lock Screen button was tapped (JS reads the taps with takePendingActions), or a Supplements
    // widget button (takePendingSupplementTaps).
    Events("onAction", "onSupplementTap")

    OnCreate {
      DarwinTapObserver.workout.start { [weak self] in
        self?.sendEvent("onAction", [:])
      }
      DarwinTapObserver.supplements.start { [weak self] in
        self?.sendEvent("onSupplementTap", [:])
      }
    }

    OnDestroy {
      DarwinTapObserver.workout.stop()
      DarwinTapObserver.supplements.stop()
    }

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

    /// Lock Screen taps the app hasn't applied yet, oldest first; reading them clears them.
    AsyncFunction("takePendingActions") { () -> [[String: Any]] in
      WorkoutActivityOutbox.takeAll()
    }

    /// Drops taps that belong to no running workout.
    AsyncFunction("clearPendingActions") { () in
      WorkoutActivityOutbox.clear()
    }

    /// The home screen widgets' data (JSON, see HomeWidgetData.swift in targets/workout-activity),
    /// or nil to clear it (signed out). Redraws the widgets only when it changed.
    AsyncFunction("setHomeWidgetData") { (json: String?) in
      HomeWidgetStore.write(json)
    }

    /// What the widgets show now (written by an earlier run), or nil.
    AsyncFunction("getHomeWidgetData") { () -> String? in
      HomeWidgetStore.read()
    }

    /// Supplements widget taps the app hasn't applied yet, oldest first; reading them clears them.
    AsyncFunction("takePendingSupplementTaps") { () -> [[String: Any]] in
      SupplementTapOutbox.takeAll()
    }
  }
}

/// Where the app leaves the home screen widgets' data: the shared App Group, read by the extension.
enum HomeWidgetStore {
  /// Same key as HomeWidgetData.swift in targets/workout-activity (npm run check:links checks).
  static let key = "momentum.homeWidgets.v1"

  private static var defaults: UserDefaults { UserDefaults(suiteName: WorkoutActivityOutbox.appGroup) ?? .standard }

  static func read() -> String? { defaults.string(forKey: key) }

  static func write(_ json: String?) {
    if defaults.string(forKey: key) == json { return }
    if let json { defaults.set(json, forKey: key) } else { defaults.removeObject(forKey: key) }
    if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
  }
}

/// Listens for the Darwin notification a tap posts (from the app or the extension): one for the
/// Lock Screen buttons, one for the Supplements widget's.
final class DarwinTapObserver {
  static let workout = DarwinTapObserver(name: WorkoutActivityOutbox.darwinName)
  static let supplements = DarwinTapObserver(name: SupplementTapOutbox.darwinName)
  private let name: String
  private var handler: (() -> Void)?
  private var observing = false

  private init(name: String) {
    self.name = name
  }

  func start(_ handler: @escaping () -> Void) {
    self.handler = handler
    guard !observing else { return }
    observing = true
    CFNotificationCenterAddObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      { _, observer, _, _, _ in
        guard let observer else { return }
        let me = Unmanaged<DarwinTapObserver>.fromOpaque(observer).takeUnretainedValue()
        DispatchQueue.main.async { me.handler?() }
      },
      name as CFString,
      nil,
      .deliverImmediately
    )
  }

  func stop() {
    handler = nil
    guard observing else { return }
    observing = false
    CFNotificationCenterRemoveObserver(
      CFNotificationCenterGetDarwinNotifyCenter(),
      Unmanaged.passUnretained(self).toOpaque(),
      CFNotificationName(name as CFString),
      nil
    )
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

  static func nonEmpty(_ s: String?) -> String? {
    guard let s, !s.isEmpty else { return nil }
    return s
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
      restEndsAt: restEndsAt,
      workoutId: nonEmpty(s.workoutId),
      workoutTitle: nonEmpty(s.workoutTitle),
      completedSets: s.completedSets,
      workoutSets: s.workoutSets,
      accentHex: nonEmpty(s.accentHex),
      restSeconds: s.restSeconds,
      lastCompletedAt: date(s.lastCompletedAt),
      current: s.current?.card,
      after: s.after?.card,
      justDone: s.justDone?.doneSet
    )
    // Stale at the rest's end: the Lock Screen then shows the between-sets view again
    // (JS can't update it from the background).
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
      // Taps not applied yet (iOS may have launched the app just to run one): the activity already
      // shows them and this restored state predates them. JS sends the state with them applied next.
      if !WorkoutActivityOutbox.hasPending {
        await current.update(content)
      }
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
