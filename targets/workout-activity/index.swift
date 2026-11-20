import SwiftUI
import WidgetKit

@main
struct WorkoutActivityBundle: WidgetBundle {
  var body: some Widget {
    WorkoutLiveActivity()
    // Home screen widgets (small); data from src/services/homeWidgets.ts.
    CaloriesWidget()
    ProteinWidget()
    MacrosWidget()
    StreakWidget()
    RecoveryWidget()
  }
}
