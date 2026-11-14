package expo.modules.workoutliveactivity

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Handles the rest-end alarm and the user swiping the workout notification away. */
class WorkoutNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      WorkoutNotification.ACTION_REST_END -> WorkoutNotification.onRestEnd(context)
      WorkoutNotification.ACTION_DISMISSED -> WorkoutNotification.onDismissed(context)
    }
  }
}
