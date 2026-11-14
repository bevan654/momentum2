package expo.modules.workoutliveactivity

import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.text.format.DateFormat
import android.util.Log
import androidx.core.app.AlarmManagerCompat
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import org.json.JSONObject
import java.util.Date

/** One snapshot of the workout, as shown in the notification. Times are epoch ms. */
internal data class LiveState(
  val workoutStartedAt: Long,
  val exerciseName: String,
  val setIndex: Int,
  val setCount: Int,
  val nextExerciseName: String?,
  val restStartedAt: Long?,
  val restEndsAt: Long?,
) {
  fun withoutRest() = copy(restStartedAt = null, restEndsAt = null)

  fun toJson(): String = JSONObject()
    .put("workoutStartedAt", workoutStartedAt)
    .put("exerciseName", exerciseName)
    .put("setIndex", setIndex)
    .put("setCount", setCount)
    .put("nextExerciseName", nextExerciseName ?: JSONObject.NULL)
    .put("restStartedAt", restStartedAt ?: JSONObject.NULL)
    .put("restEndsAt", restEndsAt ?: JSONObject.NULL)
    .toString()

  companion object {
    fun fromJson(json: String): LiveState? = try {
      val o = JSONObject(json)
      LiveState(
        workoutStartedAt = o.getLong("workoutStartedAt"),
        exerciseName = o.optString("exerciseName", ""),
        setIndex = o.optInt("setIndex", 0),
        setCount = o.optInt("setCount", 0),
        nextExerciseName = if (o.isNull("nextExerciseName")) null else o.optString("nextExerciseName"),
        restStartedAt = if (o.isNull("restStartedAt")) null else o.optLong("restStartedAt"),
        restEndsAt = if (o.isNull("restEndsAt")) null else o.optLong("restEndsAt"),
      )
    } catch (e: Exception) {
      null
    }
  }
}

/**
 * The ongoing "live activity" notification on Android.
 *
 * The status bar chronometer ticks on its own: it counts up from the workout start,
 * or, while resting, down to the rest's end. When the rest ends an alarm re-posts it
 * counting up again, because the app's JS may not be running to do it (otherwise
 * the countdown would run on into negative time). The last state is kept in
 * SharedPreferences for that alarm.
 */
internal object WorkoutNotification {
  const val ACTIVITY_ID = "workout_live"
  const val ACTION_REST_END = "expo.modules.workoutliveactivity.REST_END"
  const val ACTION_DISMISSED = "expo.modules.workoutliveactivity.DISMISSED"

  // Keep in sync with the channel App.tsx creates (whichever runs first wins).
  private const val CHANNEL_ID = "workout_live"
  private const val CHANNEL_NAME = "Active Workout"
  private const val CHANNEL_DESCRIPTION = "Your workout timer and rest countdown while you train"

  private const val NOTIFICATION_TAG = "workout_live"
  private const val NOTIFICATION_ID = 7301

  private const val REQUEST_OPEN = 7301
  private const val REQUEST_REST_END = 7302
  private const val REQUEST_DISMISSED = 7303

  private const val PREFS = "expo.modules.workoutliveactivity"
  private const val KEY_STATE = "state"
  private const val KEY_DISMISSED = "dismissed"

  /** The app's default accent (#FF3232); the theme isn't available natively. */
  private const val ACCENT = 0xFFFF3232.toInt()

  private const val META_DATA_ICON = "expo.modules.notifications.default_notification_icon"
  private const val TAG = "WorkoutLiveActivity"

  @Synchronized
  fun start(context: Context, state: LiveState) {
    prefs(context).edit().putBoolean(KEY_DISMISSED, false).apply()
    show(context, state)
  }

  /** Doesn't bring back a notification the user swiped away; the next `start` does. */
  @Synchronized
  fun update(context: Context, state: LiveState) {
    if (prefs(context).getBoolean(KEY_DISMISSED, false)) return
    show(context, state)
  }

  @Synchronized
  fun end(context: Context) {
    cancelRestEnd(context)
    NotificationManagerCompat.from(context).cancel(NOTIFICATION_TAG, NOTIFICATION_ID)
    prefs(context).edit().remove(KEY_STATE).remove(KEY_DISMISSED).apply()
  }

  /** The rest-end alarm fired: switch back to the elapsed timer. */
  @Synchronized
  fun onRestEnd(context: Context) {
    val prefs = prefs(context)
    if (prefs.getBoolean(KEY_DISMISSED, false)) return
    val state = prefs.getString(KEY_STATE, null)?.let { LiveState.fromJson(it) } ?: return
    val endsAt = state.restEndsAt ?: return
    if (endsAt > System.currentTimeMillis() + 1_000) {
      // A newer rest replaced the one this alarm was for; wait for that one.
      scheduleRestEnd(context, endsAt)
      return
    }
    show(context, state.withoutRest())
  }

  @Synchronized
  fun onDismissed(context: Context) {
    prefs(context).edit().putBoolean(KEY_DISMISSED, true).apply()
    cancelRestEnd(context)
  }

  private fun show(context: Context, state: LiveState) {
    val endsAt = state.restEndsAt
    val current = if (endsAt != null && endsAt <= System.currentTimeMillis()) state.withoutRest() else state
    prefs(context).edit().putString(KEY_STATE, current.toJson()).apply()
    post(context, current)
    val restEnd = current.restEndsAt
    if (restEnd != null) scheduleRestEnd(context, restEnd) else cancelRestEnd(context)
  }

  @SuppressLint("MissingPermission") // POST_NOTIFICATIONS is checked via areNotificationsEnabled
  private fun post(context: Context, state: LiveState) {
    val manager = NotificationManagerCompat.from(context)
    ensureChannel(manager)
    if (!manager.areNotificationsEnabled()) return

    val resting = state.restEndsAt != null
    val exerciseLine = when {
      state.exerciseName.isEmpty() -> "Workout in progress"
      state.setCount > 0 -> "${state.exerciseName} · Set ${state.setIndex}/${state.setCount}"
      else -> state.exerciseName
    }
    // The chronometer can only show one time, so the start time is a static line.
    val startedLine = "Started ${DateFormat.getTimeFormat(context).format(Date(state.workoutStartedAt))}"
    val nextLine = state.nextExerciseName?.let { "Next: $it" }
    val text = if (resting) listOfNotNull(startedLine, nextLine).joinToString(" · ") else nextLine ?: startedLine

    val builder = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIcon(context))
      .setColor(ACCENT)
      // Header reads "Momentum · Rest · 1:23" / "Momentum · Workout · 24:10".
      .setSubText(if (resting) "Rest" else "Workout")
      .setContentTitle(exerciseLine)
      .setContentText(text)
      .setStyle(NotificationCompat.BigTextStyle().bigText(text))
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setCategory(NotificationCompat.CATEGORY_WORKOUT)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setShowWhen(true)
      .setUsesChronometer(true)
      .setChronometerCountDown(resting)
      .setWhen(state.restEndsAt ?: state.workoutStartedAt)
    openAppIntent(context)?.let { builder.setContentIntent(it) }
    broadcast(context, ACTION_DISMISSED, REQUEST_DISMISSED, PendingIntent.FLAG_UPDATE_CURRENT)
      ?.let { builder.setDeleteIntent(it) }

    try {
      manager.notify(NOTIFICATION_TAG, NOTIFICATION_ID, builder.build())
    } catch (e: Exception) {
      Log.w(TAG, "Couldn't post the workout notification", e)
    }
  }

  private fun ensureChannel(manager: NotificationManagerCompat) {
    val channel = NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
      .setName(CHANNEL_NAME)
      .setDescription(CHANNEL_DESCRIPTION)
      .setShowBadge(false)
      .setVibrationEnabled(false)
      .setLightsEnabled(false)
      .setSound(null, null)
      .build()
    manager.createNotificationChannel(channel)
  }

  /** The icon expo-notifications uses: its configured default icon, else the app icon. */
  private fun smallIcon(context: Context): Int {
    try {
      val info = context.packageManager.getApplicationInfo(context.packageName, PackageManager.GET_META_DATA)
      val icon = info.metaData?.getInt(META_DATA_ICON, 0) ?: 0
      if (icon != 0) return icon
    } catch (e: Exception) {
      // fall through to the app icon
    }
    return context.applicationInfo.icon
  }

  /** Opens the app like its launcher icon does (brings the existing task forward). */
  private fun openAppIntent(context: Context): PendingIntent? {
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED)
    return PendingIntent.getActivity(
      context,
      REQUEST_OPEN,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun broadcast(context: Context, action: String, requestCode: Int, flags: Int): PendingIntent? {
    val intent = Intent(context, WorkoutNotificationReceiver::class.java).setAction(action)
    return PendingIntent.getBroadcast(context, requestCode, intent, flags or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun scheduleRestEnd(context: Context, at: Long) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = broadcast(context, ACTION_REST_END, REQUEST_REST_END, PendingIntent.FLAG_UPDATE_CURRENT) ?: return
    try {
      if (AlarmManagerCompat.canScheduleExactAlarms(alarms)) {
        AlarmManagerCompat.setExactAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, at, pending)
        return
      }
    } catch (e: SecurityException) {
      // Exact alarms were revoked between the check and the call.
    }
    AlarmManagerCompat.setAndAllowWhileIdle(alarms, AlarmManager.RTC_WAKEUP, at, pending)
  }

  private fun cancelRestEnd(context: Context) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val pending = broadcast(context, ACTION_REST_END, REQUEST_REST_END, PendingIntent.FLAG_NO_CREATE) ?: return
    alarms.cancel(pending)
    pending.cancel()
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
}
