import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import type { SummaryExercise } from '../../stores/useActiveWorkoutStore';
import Confetti from './Confetti';

interface Props {
  workoutId: string;
  exercises: SummaryExercise[];
  prevMap: Record<string, { kg: number; reps: number }[]>;
  duration: number;
  totalSets: number;
  totalExercises: number;
  /** When provided (viewing a past workout), render this saved note directly —
   * no network call, no reveal animation, no confetti. Regenerating on every
   * view would be wasteful and could drift from what was actually shown at
   * the time. */
  precomputed?: { headline: string; summary: string };
}

function CoachTakeCard({ workoutId, exercises, prevMap, duration, totalSets, totalExercises, precomputed }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(precomputed ? 'ready' : 'loading');
  const [result, setResult] = useState<{ headline: string; summary: string } | null>(precomputed ?? null);

  const reveal = useSharedValue(precomputed ? 1 : 0);

  useEffect(() => {
    if (precomputed) return; // Static view — nothing to fetch or animate.

    let cancelled = false;
    setState('loading');
    setResult(null);
    reveal.value = 0;

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
        if (error || !data?.headline || !data?.summary) {
          setState('error');
          return;
        }
        setResult({ headline: data.headline, summary: data.summary });
        setState('ready');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reveal.value = withSpring(1, { damping: 13, stiffness: 180 });

        // Persist so reopening this workout later shows the same note instead
        // of nothing (or a freshly regenerated, possibly different one).
        if (workoutId) {
          supabase
            .from('workouts')
            .update({ coach_headline: data.headline, coach_summary: data.summary })
            .eq('id', workoutId)
            .then(() => {}, () => {});
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // Only re-run if this is genuinely a different workout — exercises/prevMap
    // are stable snapshots taken at finish time, not live state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, precomputed]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [{ scale: 0.9 + reveal.value * 0.1 }],
  }));

  // Quietly skip on failure — this is a bonus on top of the summary screen,
  // not something worth surfacing an error for.
  if (state === 'error') return null;

  return (
    <View style={styles.card}>
      {state === 'ready' && !precomputed && <Confetti />}
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="flame" size={ms(14)} color={colors.accent} />
        </View>
        <Text style={styles.label}>Coach's Take</Text>
      </View>
      {state === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
          <Text style={styles.loadingText}>Crunching your numbers...</Text>
        </View>
      ) : (
        <Animated.View style={revealStyle}>
          <Text style={styles.headline}>{result!.headline}</Text>
          <Text style={styles.summary}>{result!.summary}</Text>
        </Animated.View>
      )}
    </View>
  );
}

export default React.memo(CoachTakeCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.accent + '12',
    borderRadius: sw(14),
    borderWidth: 1,
    borderColor: colors.accent + '40',
    padding: sw(14),
    marginHorizontal: sw(16),
    marginBottom: sw(12),
    gap: sw(8),
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(11),
    backgroundColor: colors.accent + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(4),
  },
  loadingText: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
  },
  headline: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  summary: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(19),
    marginTop: sw(4),
  },
});
