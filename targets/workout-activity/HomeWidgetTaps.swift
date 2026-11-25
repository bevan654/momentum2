// Kept identical in modules/workout-live-activity/ios and targets/workout-activity (npm run
// check:links checks): the Supplements widget's buttons write here, the app reads it.

import Foundation

// MARK: - Supplement taps (the Supplements home screen widget, iOS 17+)
//
// A tap on the widget runs in the widget extension, not the app, so it can't reach the user's
// account. Like the Lock Screen buttons (WorkoutActivityOutbox), each tap is left in the shared
// App Group as its own key and the app is pinged with a Darwin notification; the app saves the
// taps (src/services/supplementWidgetTaps.ts) when it gets the ping, comes to the foreground or
// starts. Its own key prefix and notification name keep it apart from the Lock Screen taps.
//
// Entries: { type: "add" | "undo", id, key, amount, userId, day, at } (`id` the entry's id in
// supplement_entries, made by the widget for an add and repeated by its undo; `key` "water" or a
// supplement's key; `day` the local day "2026-11-22"; `at` epoch ms). Mirrors SupplementWidgetTap in
// modules/workout-live-activity/index.ts.

enum SupplementTapOutbox {
  static let appGroup = "group.com.momentum.fitnessapp"
  static let darwinName = "com.momentum.fitnessapp.homeWidgets.supplementTap"
  private static let prefix = "homeWidgets.supplementTap."
  /// More unsaved taps than this (a long time offline) drops the oldest: a guard against filling
  /// the shared storage, far beyond normal use.
  private static let maxEntries = 100
  /// Within one process; across processes the per-tap keys keep writers apart.
  private static let lock = NSLock()

  private static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

  private static func keys() -> [String] {
    defaults.dictionaryRepresentation().keys.filter { $0.hasPrefix(prefix) }.sorted()
  }

  /// Leaves a tap for the app; returns its key (so an undo can take it back before it's applied).
  @discardableResult
  static func append(_ entry: [String: Any]) -> String {
    lock.lock()
    defer { lock.unlock() }
    let time = String(format: "%016.0f", (Date().timeIntervalSince1970 * 1000).rounded())
    let key = "\(prefix)\(time).\(UUID().uuidString)"
    defaults.set(entry, forKey: key)
    let all = keys()
    if all.count > maxEntries {
      for old in all.prefix(all.count - maxEntries) { defaults.removeObject(forKey: old) }
    }
    return key
  }

  /// Taps not saved yet, oldest first, without removing them: the widget adds them to what it
  /// shows, and the app removes each one only once it's saved (a failed save stays for a retry).
  static func pending() -> [(key: String, entry: [String: Any])] {
    keys().compactMap { key in defaults.dictionary(forKey: key).map { (key: key, entry: $0) } }
  }

  /// Removes a tap: the widget taking it back (Undo) or the app having saved it. False when it
  /// was already gone (the other side got there first).
  static func remove(_ key: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    guard defaults.object(forKey: key) != nil else { return false }
    defaults.removeObject(forKey: key)
    return true
  }

  /// Tells the app (if it's running) to apply the taps now.
  static func notifyApp() {
    CFNotificationCenterPostNotification(
      CFNotificationCenterGetDarwinNotifyCenter(),
      CFNotificationName(darwinName as CFString),
      nil, nil, true
    )
  }
}
