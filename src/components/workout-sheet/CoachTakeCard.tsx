import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { supabase } from '../../lib/supabase';
import type { SummaryExercise } from '../../stores/useActiveWorkoutStore';
import type { CoachExerciseNote } from '../../stores/useWorkoutStore';
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
  precomputed?: { headline: string; exercises: CoachExerciseNote[] };
}

function DeltaBadge({ note, colors, styles }: { note: CoachExerciseNote; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  if (note.isPR) {
    return (
      <View style={[styles.badge, { backgroundColor: '#D4AF3720' }]}>
        <Text style={[styles.badgeText, { color: '#D4AF37' }]}>PR</Text>
      </View>
    );
  }
  if (note.deltaPct === null || !note.hasKg) return null;
  const positive = note.deltaPct >= 0;
  const color = positive ? colors.accentGreen : colors.accentRed;
  return (
    <View style={[styles.badge, { backgroundColor: color + '18' }]}>
      <Text style={[styles.badgeText, { color }]}>
        {positive ? '+' : ''}{note.deltaPct}%
      </Text>
    </View>
  );
}

function CoachTakeCard({ workoutId, exercises, prevMap, duration, totalSets, totalExercises, precomputed }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>(precomputed ? 'ready' : 'loading');
  const [result, setResult] = useState<{ headline: string; exercises: CoachExerciseNote[] } | null>(precomputed ?? null);

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
        if (error || !data?.headline || !Array.isArray(data?.exercises) || data.exercises.length === 0) {
          setState('error');
          return;
        }
        setResult({ headline: data.headline, exercises: data.exercises });
        setState('ready');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        reveal.value = withSpring(1, { damping: 13, stiffness: 180 });

        // Persist so reopening this workout later shows the same note instead
        // of nothing (or a freshly regenerated, possibly different one).
        if (workoutId) {
          supabase
            .from('workouts')
            .update({ coach_headline: data.headline, coach_notes: data.exercises })
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
    transform: [{ scale: 0.96 + reveal.value * 0.04 }],
  }));

  // Quietly skip on failure — this is a bonus on top of the summary screen,
  // not something worth surfacing an error for.
  if (state === 'error') return null;

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      {state === 'ready' && !precomputed && <Confetti />}

      {state === 'loading' ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.textTertiary} />
          <Text style={styles.loadingText}>Reviewing the tape...</Text>
        </View>
      ) : (
        <Animated.View style={revealStyle}>
          <Text style={styles.eyebrow}>Coach's verdict</Text>
          <Text style={styles.headline}>{result!.headline}</Text>

          <View style={styles.rows}>
            {result!.exercises.map((note, i) => (
              <View
                key={note.name}
                style={[styles.row, i === result!.exercises.length - 1 && styles.rowLast]}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.exerciseName} numberOfLines={1}>{note.name}</Text>
                  <DeltaBadge note={note} colors={colors} styles={styles} />
                </View>
                <Text style={styles.exerciseNote}>{note.note}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
}

export default React.memo(CoachTakeCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginHorizontal: sw(16),
    marginBottom: sw(12),
    paddingVertical: sw(14),
    paddingHorizontal: sw(16),
    paddingLeft: sw(19),
    overflow: 'hidden',
    position: 'relative',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: sw(3),
    backgroundColor: colors.accent,
  },
  eyebrow: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: sw(4),
  },
  headline: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(23),
    letterSpacing: -0.2,
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
  rows: {
    marginTop: sw(12),
  },
  row: {
    paddingVertical: sw(9),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  rowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sw(8),
  },
  exerciseName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(13.5),
    fontFamily: Fonts.semiBold,
  },
  badge: {
    paddingHorizontal: sw(8),
    paddingVertical: sw(2),
    borderRadius: sw(8),
  },
  badgeText: {
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    fontVariant: ['tabular-nums'],
  },
  exerciseNote: {
    color: colors.textSecondary,
    fontSize: ms(12.5),
    fontFamily: Fonts.medium,
    lineHeight: ms(17),
    marginTop: sw(2),
  },
});
