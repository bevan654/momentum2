package expo.modules.workoutliveactivity

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** What JS sends; times are epoch milliseconds. Mirrors `WorkoutLiveActivityState` in index.ts. */
class WorkoutLiveActivityState : Record {
  @Field var workoutStartedAt: Double = 0.0
  @Field var exerciseName: String = ""
  @Field var setIndex: Int = 0
  @Field var setCount: Int = 0
  @Field var nextExerciseName: String? = null
  @Field var restStartedAt: Double? = null
  @Field var restEndsAt: Double? = null

  internal fun toLiveState() = LiveState(
    workoutStartedAt = workoutStartedAt.toLong(),
    exerciseName = exerciseName,
    setIndex = setIndex,
    setCount = setCount,
    nextExerciseName = nextExerciseName?.takeIf { it.isNotEmpty() },
    restStartedAt = restStartedAt?.toLong(),
    restEndsAt = restEndsAt?.toLong(),
  )
}

class WorkoutLiveActivityModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WorkoutLiveActivity")

    // Posting fails quietly when notifications are off, so the module is always usable.
    Function("isSupported") { true }

    AsyncFunction("start") { state: WorkoutLiveActivityState ->
      WorkoutNotification.start(context, state.toLiveState())
      WorkoutNotification.ACTIVITY_ID
    }

    AsyncFunction("update") { state: WorkoutLiveActivityState ->
      WorkoutNotification.update(context, state.toLiveState())
    }

    AsyncFunction("end") {
      WorkoutNotification.end(context)
    }

    AsyncFunction("endAll") {
      WorkoutNotification.end(context)
    }
  }
}
