import AppIntents
import SwiftUI
import WidgetKit

// The Supplements widget (medium): water and the tracked supplements as tiles, one row of 3 a page. On iOS 17+
// tapping a tile adds its first quick amount, ‹ › flip the pages and an "Added … · Undo" line takes
// the last tap back; on iOS 16 the whole widget opens Nutrition. The taps go through
// SupplementTapOutbox (HomeWidgetTaps.swift) to the app, which saves them to the account; until it
// has, the widget adds them to what the app last wrote, so a tap shows at once.

/// The widget's own state in the App Group: the page shown and the last tap (for its Undo line).
enum SupplementWidgetState {
  struct LastTap: Codable {
    /// The outbox entry, while the app hasn't taken it.
    var outboxKey: String
    var key: String
    var name: String
    var unit: String
    var amount: Double
    var userId: String
    var day: String
    /// Epoch seconds.
    var at: Double
  }

  /// How long the Undo line stays.
  static let undoSeconds: TimeInterval = 60
  private static let pageKey = "homeWidgets.supplements.page"
  private static let lastTapKey = "homeWidgets.supplements.lastTap"
  private static var defaults: UserDefaults { UserDefaults(suiteName: SupplementTapOutbox.appGroup) ?? .standard }

  static var page: Int {
    get { defaults.integer(forKey: pageKey) }
    set { defaults.set(newValue, forKey: pageKey) }
  }

  static var lastTap: LastTap? {
    get { defaults.data(forKey: lastTapKey).flatMap { try? JSONDecoder().decode(LastTap.self, from: $0) } }
    set {
      if let newValue, let data = try? JSONEncoder().encode(newValue) {
        defaults.set(data, forKey: lastTapKey)
      } else {
        defaults.removeObject(forKey: lastTapKey)
      }
    }
  }
}

// MARK: - Intents (iOS 17+; parameters are set in init: widgets don't resolve them)

@available(iOS 17.0, *)
struct AddSupplementTapIntent: AppIntent {
  static let title: LocalizedStringResource = "Add supplement"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Key") var key: String
  @Parameter(title: "Name") var name: String
  @Parameter(title: "Unit") var unit: String
  @Parameter(title: "Amount") var amount: Double
  @Parameter(title: "User") var userId: String
  @Parameter(title: "Day") var day: String

  init() {}
  init(tile: HomeWidgetData.SupplementTile, userId: String, day: String) {
    self.key = tile.key
    self.name = tile.name
    self.unit = tile.unit
    self.amount = tile.step
    self.userId = userId
    self.day = day
  }

  func perform() async throws -> some IntentResult {
    let now = Date()
    let outboxKey = SupplementTapOutbox.append([
      "type": "add", "key": key, "amount": amount, "userId": userId, "day": day,
      "at": (now.timeIntervalSince1970 * 1000).rounded(),
    ])
    SupplementWidgetState.lastTap = .init(
      outboxKey: outboxKey, key: key, name: name, unit: unit, amount: amount, userId: userId, day: day,
      at: now.timeIntervalSince1970
    )
    SupplementTapOutbox.notifyApp()
    return .result()
  }
}

@available(iOS 17.0, *)
struct UndoSupplementTapIntent: AppIntent {
  static let title: LocalizedStringResource = "Undo supplement"
  static let isDiscoverable: Bool = false

  init() {}

  func perform() async throws -> some IntentResult {
    guard let last = SupplementWidgetState.lastTap else { return .result() }
    SupplementWidgetState.lastTap = nil
    // Not applied yet: take it back. Applied: ask the app to remove that supplement's latest entry.
    if !SupplementTapOutbox.remove(last.outboxKey) {
      SupplementTapOutbox.append([
        "type": "undo", "key": last.key, "amount": last.amount, "userId": last.userId, "day": last.day,
        "at": (Date().timeIntervalSince1970 * 1000).rounded(),
      ])
      SupplementTapOutbox.notifyApp()
    }
    return .result()
  }
}

@available(iOS 17.0, *)
struct SupplementPageIntent: AppIntent {
  static let title: LocalizedStringResource = "Change page"
  static let isDiscoverable: Bool = false

  @Parameter(title: "Change") var delta: Int

  init() {}
  init(delta: Int) { self.delta = delta }

  func perform() async throws -> some IntentResult {
    SupplementWidgetState.page += delta
    return .result()
  }
}

// MARK: - Timeline

struct SupplementsEntry: TimelineEntry {
  let date: Date
  let data: HomeWidgetData?
  let lastTap: SupplementWidgetState.LastTap?
  let page: Int
  /// Taps the app hasn't applied yet, as an amount per key (adds minus undos) for the data's user and day.
  let pending: [String: Double]
}

/// Now, when the Undo line should go, and midnight (a new day). The data, the pending taps and the
/// widget's state are read once per timeline and shared by its entries.
struct SupplementsProvider: TimelineProvider {
  /// What every entry of one timeline shares.
  private struct Shared {
    let data: HomeWidgetData?
    let lastTap: SupplementWidgetState.LastTap?
    let page: Int
    /// The taps the app hasn't applied yet, for the data's user: (day, key, amount; negative = undo).
    let taps: [(day: String, key: String, amount: Double)]

    init(preview: Bool) {
      let data = preview ? (HomeWidgetData.load() ?? .preview) : HomeWidgetData.load()
      self.data = data
      lastTap = SupplementWidgetState.lastTap
      page = SupplementWidgetState.page
      taps = SupplementTapOutbox.pending().compactMap { item -> (day: String, key: String, amount: Double)? in
        let tap = item.entry
        guard
          tap["userId"] as? String == data?.userId, let day = tap["day"] as? String,
          let key = tap["key"] as? String, let amount = (tap["amount"] as? NSNumber)?.doubleValue
        else { return nil }
        return (day: day, key: key, amount: tap["type"] as? String == "undo" ? -amount : amount)
      }
    }

    func entry(at date: Date) -> SupplementsEntry {
      let day = HomeWidgetDay.key(date)
      var pending: [String: Double] = [:]
      for tap in taps where tap.day == day { pending[tap.key, default: 0] += tap.amount }
      return SupplementsEntry(date: date, data: data, lastTap: lastTap, page: page, pending: pending)
    }
  }

  func placeholder(in context: Context) -> SupplementsEntry {
    SupplementsEntry(date: Date(), data: .preview, lastTap: nil, page: 0, pending: [:])
  }

  func getSnapshot(in context: Context, completion: @escaping (SupplementsEntry) -> Void) {
    completion(Shared(preview: context.isPreview).entry(at: Date()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SupplementsEntry>) -> Void) {
    let shared = Shared(preview: false)
    let now = Date()
    let midnight = HomeWidgetDay.nextMidnight(after: now)
    var dates = [now]
    if let last = shared.lastTap {
      let end = Date(timeIntervalSince1970: last.at + SupplementWidgetState.undoSeconds)
      if end > now && end < midnight { dates.append(end) }
    }
    dates.append(midnight)
    completion(Timeline(entries: dates.map { shared.entry(at: $0) }, policy: .after(midnight)))
  }
}

// MARK: - Look

/// "250", "1.5", "0.25": no trailing zeros.
private func amountText(_ value: Double) -> String {
  let rounded = (value * 100).rounded() / 100
  if rounded == rounded.rounded() { return String(Int(rounded)) }
  return String(format: rounded * 10 == (rounded * 10).rounded() ? "%.1f" : "%.2f", rounded)
}

/// Water in litres once the goal is a litre or more ("1.8 / 3 L"), else as stored ("200 / 400 mg").
private func progressText(_ tile: HomeWidgetData.SupplementTile, amount: Double) -> String {
  if tile.key == "water" && tile.goal >= 1000 {
    return "\(amountText(amount / 1000)) / \(amountText(tile.goal / 1000)) L"
  }
  return "\(amountText(amount)) / \(amountText(tile.goal)) \(tile.unit)"
}

private func tileColor(_ tile: HomeWidgetData.SupplementTile) -> Color {
  tile.color.map { HomeWidgetColor.accent($0) } ?? HomeWidgetColor.water
}

struct SupplementsWidgetView: View {
  let entry: SupplementsEntry

  private static let perPage = 3

  var body: some View {
    Group {
      if let message = homeWidgetBlocker(entry.data, hasSection: entry.data?.supplements != nil) {
        HomeWidgetMessage(symbol: "pills.fill", title: "Supplements", tint: HomeWidgetColor.green, message: message)
      } else if let supplements = entry.data?.supplements {
        content(supplements)
      }
    }
    .homeWidgetBackground()
    .widgetURL(HomeWidgetLink.nutrition)
  }

  @ViewBuilder
  private func content(_ s: HomeWidgetData.Supplements) -> some View {
    let today = HomeWidgetDay.key(entry.date)
    let pageCount = max(1, (s.tiles.count + Self.perPage - 1) / Self.perPage)
    let page = ((entry.page % pageCount) + pageCount) % pageCount
    let tiles = Array(s.tiles.dropFirst(page * Self.perPage).prefix(Self.perPage))
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 6) {
        HomeWidgetTitle(symbol: "pills.fill", text: "Supplements", tint: HomeWidgetColor.green, brand: false)
        Spacer(minLength: 4)
        if let last = undoable(today: today) {
          undoLine(last)
        } else if pageCount > 1 {
          pager(page: page, count: pageCount)
        }
        HomeWidgetBrand()
      }
      // One row of up to 3 tiles filling the height left; a short last page keeps the tiles' width.
      HStack(spacing: 8) {
        ForEach(0..<Self.perPage, id: \.self) { i in
          if i < tiles.count {
            let tile = tiles[i]
            // Another day's amounts count as nothing yet.
            let stored = s.date == today ? tile.amount : 0
            tileButton(tile, amount: max(0, stored + (entry.pending[tile.key] ?? 0)), today: today)
          } else {
            Color.clear.frame(maxWidth: .infinity, maxHeight: .infinity)
          }
        }
      }
    }
  }

  /// The last tap, while its Undo line should show (same user and day, under a minute old).
  private func undoable(today: String) -> SupplementWidgetState.LastTap? {
    guard
      #available(iOS 17.0, *),
      let last = entry.lastTap,
      last.userId == entry.data?.userId,
      last.day == today,
      entry.date.timeIntervalSince1970 - last.at < SupplementWidgetState.undoSeconds
    else { return nil }
    return last
  }

  @ViewBuilder
  private func undoLine(_ last: SupplementWidgetState.LastTap) -> some View {
    if #available(iOS 17.0, *) {
      HStack(spacing: 4) {
        Text("Added \(amountText(last.amount)) \(last.unit)")
          .font(.caption2)
          .foregroundColor(.secondary)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
        Button(intent: UndoSupplementTapIntent()) {
          Text("Undo").font(.caption2.weight(.semibold)).foregroundColor(HomeWidgetColor.water)
        }
        .buttonStyle(.plain)
      }
    }
  }

  @ViewBuilder
  private func pager(page: Int, count: Int) -> some View {
    if #available(iOS 17.0, *) {
      HStack(spacing: 5) {
        Button(intent: SupplementPageIntent(delta: -1)) { pagerArrow("chevron.left") }.buttonStyle(.plain)
        HStack(spacing: 3) {
          ForEach(0..<min(count, 5), id: \.self) { i in
            Circle().fill(i == page ? Color.primary : Color.primary.opacity(0.25)).frame(width: 5, height: 5)
          }
        }
        Button(intent: SupplementPageIntent(delta: 1)) { pagerArrow("chevron.right") }.buttonStyle(.plain)
      }
    }
  }

  private func pagerArrow(_ symbol: String) -> some View {
    Image(systemName: symbol)
      .font(.system(size: 9, weight: .bold))
      .foregroundColor(.primary)
      .frame(width: 18, height: 18)
      .background(Circle().fill(Color.primary.opacity(0.08)))
  }

  @ViewBuilder
  private func tileButton(_ tile: HomeWidgetData.SupplementTile, amount: Double, today: String) -> some View {
    if #available(iOS 17.0, *), let userId = entry.data?.userId {
      Button(intent: AddSupplementTapIntent(tile: tile, userId: userId, day: today)) {
        tileView(tile, amount: amount)
      }
      .buttonStyle(.plain)
    } else {
      tileView(tile, amount: amount)
    }
  }

  private func tileView(_ tile: HomeWidgetData.SupplementTile, amount: Double) -> some View {
    let color = tileColor(tile)
    let done = tile.goal > 0 && amount >= tile.goal
    // Icon and "+250" on top, then the name, today's amount and a bar at the bottom; about 80 pt
    // tall, which fits the medium widget on every iPhone, the SE's (about 116 pt inside its
    // margins, less the title row) included.
    return VStack(alignment: .leading, spacing: 0) {
      HStack(alignment: .center) {
        Image(systemName: done ? "checkmark" : tile.icon)
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(done ? HomeWidgetColor.green : color)
          .frame(width: 26, height: 26)
          .background(Circle().fill((done ? HomeWidgetColor.green : color).opacity(0.18)))
        Spacer(minLength: 4)
        Text("+\(amountText(tile.step))")
          .font(.caption.weight(.bold))
          .monospacedDigit()
          .foregroundColor(color)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      Spacer(minLength: 4)
      Text(tile.name).font(.caption.weight(.semibold)).lineLimit(1).minimumScaleFactor(0.75)
      Text(progressText(tile, amount: amount))
        .font(.caption2)
        .monospacedDigit()
        .foregroundColor(.secondary)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.bottom, 4)
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.primary.opacity(0.12))
          Capsule().fill(color).frame(width: geo.size.width * min(max(tile.goal > 0 ? amount / tile.goal : 0, 0), 1))
        }
      }
      .frame(height: 4)
    }
    .padding(9)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.primary.opacity(0.07)))
  }
}

struct SupplementsWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "MomentumSupplements", provider: SupplementsProvider()) { SupplementsWidgetView(entry: $0) }
      .configurationDisplayName("Supplements")
      .description("Water and your supplements for today. Tap one to add it (iOS 17 or later).")
      .supportedFamilies([.systemMedium])
  }
}
