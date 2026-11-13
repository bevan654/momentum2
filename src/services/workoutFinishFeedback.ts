import AsyncStorage from '@react-native-async-storage/async-storage';
import { BUILD_VERSION } from '../constants/buildInfo';
import { supabase } from '../lib/supabase';

export type WorkoutFinishFeedbackResponse = 'worked_normally' | 'had_issue';

// New campaign after replacing the original native Alert with the Momentum
// modal. Keeping a separate id preserves the first response while allowing
// existing testers to see the redesigned prompt once.
const FEEDBACK_CAMPAIGN = 'workout-finish-hang-2026-07-momentum-modal';
const submittedKey = (userId: string) =>
  `workout-finish-feedback-submitted:${FEEDBACK_CAMPAIGN}:${userId}`;
const pendingKey = (userId: string) =>
  `workout-finish-feedback-pending:${FEEDBACK_CAMPAIGN}:${userId}`;

export interface PendingWorkoutFinishFeedback {
  workoutId: string | null;
}

export async function queueWorkoutFinishFeedback(params: {
  userId: string;
  workoutId: string | null;
}): Promise<void> {
  const { userId, workoutId } = params;
  try {
    if ((await AsyncStorage.getItem(submittedKey(userId))) === 'submitted') return;
    await AsyncStorage.setItem(pendingKey(userId), JSON.stringify({ workoutId }));
  } catch {}
}

export async function getPendingWorkoutFinishFeedback(
  userId: string,
): Promise<PendingWorkoutFinishFeedback | null> {
  try {
    if ((await AsyncStorage.getItem(submittedKey(userId))) === 'submitted') return null;
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingWorkoutFinishFeedback>;
    return { workoutId: typeof parsed.workoutId === 'string' ? parsed.workoutId : null };
  } catch {
    return null;
  }
}

export async function submitWorkoutFinishFeedback(params: {
  userId: string;
  workoutId: string | null;
  response: WorkoutFinishFeedbackResponse;
}): Promise<void> {
  const { userId, workoutId, response } = params;
  try {
    const { error } = await supabase.from('workout_finish_feedback').insert({
      user_id: userId,
      workout_id: workoutId,
      response,
      campaign: FEEDBACK_CAMPAIGN,
      build_version: BUILD_VERSION,
      source: 'post_workout',
    });
    if (error) {
      if (__DEV__) console.warn('[workoutFinishFeedback] insert failed:', error.message);
      return;
    }
    await AsyncStorage.multiSet([
      [submittedKey(userId), 'submitted'],
      [pendingKey(userId), ''],
    ]);
  } catch (error) {
    if (__DEV__) console.warn('[workoutFinishFeedback] submit failed:', error);
  }
}
