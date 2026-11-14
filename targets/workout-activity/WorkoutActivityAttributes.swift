import ActivityKit
import Foundation

// Keep identical to modules/workout-live-activity/ios/WorkoutActivityAttributes.swift:
// ActivityKit matches the app's and the extension's copies by type name and Codable shape.
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
  }
}
