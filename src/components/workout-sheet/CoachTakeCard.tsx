import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import type { SummaryExercise } from '../../stores/useActiveWorkoutStore';
import type { CoachExerciseNote } from '../../stores/useWorkoutStore';
import Confetti from './Confetti';

export type CoachResult = { headline: string; exercises: CoachExerciseNote[] };

interface Props {
  workoutId: string;
  exercises: SummaryExercise[];
  prevMap: Record<string, { kg: number; reps: number }[]>;
  duration: number;
  totalSets: number;
  totalExercises: number;
  /** Reports the generated (and persisted) notes back to the parent, which
   * attaches each one to its own exercise's summary card — there's no
   * separate "coach" section anymore. Called with null on failure. */
  onResult: (result: CoachResult | null) => void;
}

/** Fetches the coach's per-exercise notes right after a workout finishes,
 * persists them, and hands them to the parent. Renders only a brief loading
 * state and a confetti burst on success — the actual notes live on each
 * exercise's own card. */
function CoachTakeCard({ workoutId, exercises, prevMap, duration, totalSets, totalExercises, onResult }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('ai-workout-summary', {
          body: {
            exercises: exercises.map((ex) => ({
              name: ex.name,
              exercise_type: ex.exercise_type,
              sets: ex.sets.map((s) => ({
                kg: s.kg,
                reps: s.reps,
                completed: s.completed,
                set_type: s.set_type,
              })),
            })),
            prevMap,
            duration,
            totalSets,
            totalExercises,
          },
        });
        if (cancelled) return;
        if (error || !data?.headline || !Array.isArray(data?.exercises) || data.exercises.length === 0) {
          setState('error');
          onResult(null);
          return;
        }
        setState('ready');
        onResult({ headline: data.headline, exercises: data.exercises });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Persist so reopening this workout later shows the same notes instead
        // of nothing (or freshly regenerated, possibly different ones).
        if (workoutId) {
          supabase
            .from('workouts')
            .update({ coach_headline: data.headline, coach_notes: data.exercises })
            .eq('id', workoutId)
            .then(() => {}, () => {});
        }
      } catch {
        if (!cancelled) {
          setState('error');
          onResult(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId]);

  if (state === 'error') return null;

  if (state === 'loading') {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Reviewing your workout</Text>
      </View>
    );
  }

  return <Confetti />;
}

export default React.memo(CoachTakeCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(10),
    paddingVertical: sw(28),
    marginHorizontal: sw(16),
    marginBottom: sw(4),
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: ms(13.5),
    fontFamily: Fonts.semiBold,
  },
});
