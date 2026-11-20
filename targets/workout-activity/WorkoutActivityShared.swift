// Shared by the app (modules/workout-live-activity/ios) and the Lock Screen extension
// (targets/workout-activity). Both copies must stay byte-identical: npm run check:links checks.
//
// The Lock Screen buttons run as App Intents. Depending on the iOS version and whether the app is
// running, iOS runs them in the app or in the extension, so everything here works in either:
//  1. the intent updates the Live Activity straight away (the app's JS may be asleep),
//  2. it records the tap in an outbox in the shared App Group,
//  3. it pings the app (Darwin notification); the app replays the outbox through the same store
//     actions as tapping in the app, now if it's running, else the next time it runs.

import ActivityKit
import AppIntents
import Foundation
import UserNotifications

// MARK: - Set maths (also used by the Lock Screen view)

enum WorkoutSetMath {
  static func usesKg(_ kind: String) -> Bool { kind == "weighted" || kind == "weightedBodyweight" }

  /// "80", "82.5"
  static func kgText(_ kg: Double) -> String {
    let rounded = (kg * 100).rounded() / 100
    if rounded == rounded.rounded() { return String(Int(rounded)) }
    var s = String(format: "%.2f", rounded)
    while s.hasSuffix("0") { s.removeLast() }
    return s
  }

  /// "45s", "1:30"
  static func secondsText(_ total: Int) -> String {
    let t = max(0, total)
    if t < 60 { return "\(t)s" }
    return "\(t / 60):" + String(format: "%02d", t % 60)
  }

  /// The weight part: "80 kg", "BW + 10 kg", "BW"; nil when the kind has no weight.
  static func weightText(kind: String, kg: Double?) -> String? {
    switch kind {
    case "weighted": return kg.map { "\(kgText($0)) kg" }
    case "weightedBodyweight":
      if let kg, kg > 0 { return "BW + \(kgText(kg)) kg" }
      return "BW"
    default: return nil
    }
  }

  /// "80 kg × 8", "BW + 10 kg × 8", "8 reps", "45s"; nil when nothing is known.
  static func setText(kind: String, kg: Double?, reps: Int?) -> String? {
    if kind == "duration" { return reps.map { secondsText($0) } }
    if kind == "bodyweight" { return reps.map { "\($0) reps" } }
    let weight = weightText(kind: kind, kg: kg) ?? "— kg"
    guard let reps else { return kg == nil ? nil : weight }
    return "\(weight) × \(reps)"
  }

  /// Compared with last time: ("+1 rep", 1), ("−2.5 kg", -1), ("Same", 0); nil without a last time.
  static func delta(kind: String, kg: Double?, reps: Int?, lastKg: Double?, lastReps: Int?) -> (text: String, sign: Int)? {
    if usesKg(kind), let kg, let lastKg, abs(kg - lastKg) >= 0.01 {
      let d = kg - lastKg
      return ("\(d > 0 ? "+" : "−")\(kgText(abs(d))) kg", d > 0 ? 1 : -1)
    }
    guard let reps, let lastReps else { return nil }
    let d = reps - lastReps
    if d == 0 { return ("Same", 0) }
    let n = abs(d)
    let unit = kind == "duration" ? "s" : (n == 1 ? " rep" : " reps")
    return ("\(d > 0 ? "+" : "−")\(n)\(unit)", d > 0 ? 1 : -1)
  }

  /// "Heaviest ever", "Most reps at 80 kg", "Most reps ever", "Longest ever"; nil when it isn't a PR.
  /// Mirrors prLabel in src/stores/activeWorkout/liveActivitySnapshot.ts.
  static func prLabel(kind: String, kg: Double?, reps: Int?, prKg: Double?, prReps: Int?) -> String? {
    guard prKg != nil || prReps != nil else { return nil } // no history: nothing to beat
    if usesKg(kind), let kg, kg > 0, let prKg, kg > prKg + 0.001 { return "Heaviest ever" }
    guard let reps, let prReps, reps > prReps else { return nil }
    if kind == "duration" { return "Longest ever" }
    if usesKg(kind), let kg, kg > 0 { return "Most reps at \(kgText(kg)) kg" }
    return "Most reps ever"
  }
}

extension WorkoutSetCard {
  /// Identifies the set in a button, so a tap on an out-of-date card is ignored.
  var key: String { "\(exerciseId)#\(setPosition)" }

  /// Same rule as ticking a set in the app: reps always, plus weight for weighted exercises.
  var canComplete: Bool {
    guard reps != nil else { return false }
    return kind != "weighted" || kg != nil
  }
}

// MARK: - Outbox (taps the app hasn't applied yet)

enum WorkoutActivityOutbox {
  static let appGroup = "group.com.momentum.fitnessapp"
  static let darwinName = "com.momentum.fitnessapp.workoutLiveActivity.action"
  private static let key = "workoutLiveActivity.outbox"
  private static let maxEntries = 100

  private static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

  static func append(_ entry: [String: Any]) {
    var list = defaults.array(forKey: key) as? [[String: Any]] ?? []
    list.append(entry)
    if list.count > maxEntries { list.removeFirst(list.count - maxEntries) }
    defaults.set(list, forKey: key)
  }

  static func takeAll() -> [[String: Any]] {
    let list = defaults.array(forKey: key) as? [[String: Any]] ?? []
    defaults.removeObject(forKey: key)
    return list
  }

  static func clear() { defaults.removeObject(forKey: key) }

  /// Tells the app (if it's running) to apply the outbox now.
  static func notifyApp() {
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(darwinName as CFString),
      nil, nil, true
    )
  }
}

// MARK: - Rest-complete alert (the same request the app schedules through expo-notifications)

enum WorkoutRestAlert {
  /// REST_NOTIF_ID in src/stores/activeWorkout/constants.ts.
  static let identifier = "rest-timer"

  static func schedule(seconds: Int) {
    guard seconds > 0 else { return }
    let content = UNMutableNotificationContent()
    content.title = "Rest Complete!"
    content.body = "Time for your next set."
    content.sound = .default
    // expo-notifications keeps `data` under "body".
    content.userInfo = ["body": ["type": "rest_complete"]]
    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(seconds), repeats: false)
    let center = UNUserNotificationCenter.current()
    center.removePendingNotificationRequests(withIdentifiers: [identifier])
    center.add(UNNotificationRequest(identifier: identifier, content: content, trigger: trigger))
  }

  static func cancel() {
    UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [identifier])
  }
}

// MARK: - What each button does

@available(iOS 17.0, *)
enum WorkoutActivityActions {
  typealias State = WorkoutActivityAttributes.ContentState

  private static var activity: Activity<WorkoutActivityAttributes>? {
    Activity<WorkoutActivityAttributes>.activities.first { $0.activityState == .active || $0.activityState == .stale }
  }

  private static func ms(_ date: Date) -> Double { (date.timeIntervalSince1970 * 1000).rounded() }

  private static func push(_ activity: Activity<WorkoutActivityAttributes>, _ state: State) async {
    await activity.update(ActivityContent(state: state, staleDate: state.restEndsAt))
  }

  static func completeSet(setKey: String) async {
    guard let activity else { return }
    var s = activity.content.state
    guard let card = s.current, card.key == setKey, card.canComplete else { return }
    let now = Date()

    s.justDone = WorkoutDoneSet(
      exerciseName: card.exerciseName,
      setIndex: card.setIndex,
      kind: card.kind,
      kg: card.kg,
      reps: card.reps,
      lastKg: card.lastKg,
      lastReps: card.lastReps,
      prLabel: WorkoutSetMath.prLabel(kind: card.kind, kg: card.kg, reps: card.reps, prKg: card.prKg, prReps: card.prReps)
    )
    s.completedSets = (s.completedSets ?? 0) + 1
    s.lastCompletedAt = now
    let rest = s.restSeconds ?? 0
    if rest > 0 {
      s.restStartedAt = now
      s.restEndsAt = now.addingTimeInterval(TimeInterval(rest))
    } else {
      s.restStartedAt = nil
      s.restEndsAt = nil
    }
    s.current = s.after
    s.after = nil
    if let next = s.current {
      s.exerciseName = next.exerciseName
      s.setIndex = next.setIndex
      s.setCount = next.setCount
    }
    await push(activity, s)

    var entry: [String: Any] = [
      "type": "complete",
      "workoutId": s.workoutId ?? "",
      "exerciseId": card.exerciseId,
      "setPosition": card.setPosition,
      "reps": card.reps ?? 0,
      "at": ms(now),
    ]
    if let kg = card.kg { entry["kg"] = kg }
    WorkoutActivityOutbox.append(entry)
    WorkoutRestAlert.schedule(seconds: rest)
    WorkoutActivityOutbox.notifyApp()
  }

  static func adjustReps(setKey: String, delta: Int) async {
    guard let activity else { return }
    var s = activity.content.state
    guard var card = s.current, card.key == setKey, card.kind != "duration", let reps = card.reps else { return }
    let next = min(999, max(1, reps + delta))
    guard next != reps else { return }
    card.reps = next
    s.current = card
    await push(activity, s)

    WorkoutActivityOutbox.append([
      "type": "reps",
      "workoutId": s.workoutId ?? "",
      "exerciseId": card.exerciseId,
      "setPosition": card.setPosition,
      "reps": next,
      "at": ms(Date()),
    ])
    WorkoutActivityOutbox.notifyApp()
  }

  static func endRest() async {
    guard let activity else { return }
    var s = activity.content.state
    guard s.restEndsAt != nil else { return }
    s.restStartedAt = nil
    s.restEndsAt = nil
    await push(activity, s)

    WorkoutActivityOutbox.append(["type": "endRest", "workoutId": s.workoutId ?? "", "at": ms(Date())])
    WorkoutRestAlert.cancel()
    WorkoutActivityOutbox.notifyApp()
  }
}

// MARK: - The intents (parameters are set in init: widgets don't resolve them)

@available(iOS 17.0, *)
struct CompleteWorkoutSetIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Complete set"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Set") var setKey: String

  init() {}
  init(setKey: String) { self.setKey = setKey }

  func perform() async throws -> some IntentResult {
    await WorkoutActivityActions.completeSet(setKey: setKey)
    return .result()
  }
}

@available(iOS 17.0, *)
struct AdjustWorkoutRepsIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "Change reps"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Set") var setKey: String
  @Parameter(title: "Change") var delta: Int

  init() {}
  init(setKey: String, delta: Int) {
    self.setKey = setKey
    self.delta = delta
  }

  func perform() async throws -> some IntentResult {
    await WorkoutActivityActions.adjustReps(setKey: setKey, delta: delta)
    return .result()
  }
}

@available(iOS 17.0, *)
struct EndWorkoutRestIntent: LiveActivityIntent {
  static let title: LocalizedStringResource = "End rest"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    await WorkoutActivityActions.endRest()
    return .result()
  }
}
