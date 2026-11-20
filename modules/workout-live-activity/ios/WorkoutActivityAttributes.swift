import ActivityKit
import Foundation

// Keep identical to targets/workout-activity/WorkoutActivityAttributes.swift from the
// `struct` line down (npm run check:links compares them): ActivityKit matches the app's and the
// extension's copies by type name and Codable shape.
@available(iOS 16.1, *)
struct WorkoutActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// When the workout started; the elapsed timer counts up from here.
    var workoutStartedAt: Date
    /// Current exercise; empty when the workout has none yet.
    var exerciseName: String
    /// 1-based set the user is on, and the exercise's set count.
    var setIndex: Int
    var setCount: Int
    /// The exercise after the current one, if any.
    var nextExerciseName: String?
    /// Original start and end of the current rest; both nil when not resting.
    var restStartedAt: Date?
    var restEndsAt: Date?

    // Added in 1.0.38 for the Lock Screen. All optional, so state saved by an
    // earlier build (an activity still showing across an update) still decodes.
    var workoutId: String?
    /// Routine / program-day name; nil for a plain workout.
    var workoutTitle: String?
    /// Sets ticked off across the whole workout, and the workout's set count.
    var completedSets: Int?
    var workoutSets: Int?
    /// The app's accent colour, "#RRGGBB".
    var accentHex: String?
    /// Length of a new rest; a set ticked off on the Lock Screen starts one this long.
    var restSeconds: Int?
    /// When the latest set was ticked off ("Since last set").
    var lastCompletedAt: Date?
    /// The set the user is on (while resting: the one coming up).
    var current: WorkoutSetCard?
    /// The set after `current`, so "Done set" can move on without the app running.
    var after: WorkoutSetCard?
    /// The set ticked off most recently, for the stat shown while resting.
    var justDone: WorkoutDoneSet?
  }
}

/// One set as the Lock Screen shows it. `kind`: weighted | bodyweight | weightedBodyweight | duration.
struct WorkoutSetCard: Codable, Hashable {
  var exerciseId: String
  var exerciseName: String
  /// 0-based position in the exercise's sets (identifies the set to the app).
  var setPosition: Int
  /// 1-based label ("set 2 of 4") and the exercise's set count.
  var setIndex: Int
  var setCount: Int
  var kind: String
  /// Planned weight (added weight for weightedBodyweight) and reps (seconds for duration).
  var kg: Double?
  var reps: Int?
  /// The same set in the last session.
  var lastKg: Double?
  var lastReps: Int?
  /// Best before this set: heaviest weight, and most reps at this weight or heavier
  /// (most reps / longest for bodyweight and timed). Both nil when there's no history yet.
  var prKg: Double?
  var prReps: Int?
  /// One letter per set of the exercise: d = done, c = this one, p = to do.
  var setStates: String
}

struct WorkoutDoneSet: Codable, Hashable {
  var exerciseName: String
  var setIndex: Int
  var kind: String
  var kg: Double?
  var reps: Int?
  var lastKg: Double?
  var lastReps: Int?
  /// "Heaviest ever", "Most reps at 80 kg"…; nil when it isn't a PR.
  var prLabel: String?
}
