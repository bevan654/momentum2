import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore, type ActiveExercise } from '../../stores/useActiveWorkoutStore';
import { compareGhostSet } from '../../utils/ghostCompare';

/* ─── GhostTally ─────────────────────────────────────────── */

export const GhostTally = React.memo(function GhostTally({
  exercises,
}: {
  exercises: ActiveExercise[];
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ghostUserName = useActiveWorkoutStore((s) => s.ghostUserName);

  const tally = useMemo(() => {
    if (!ghostUserName) return null;
    let wins = 0;
    let losses = 0;
    let ties = 0;

    for (const ex of exercises) {
      if (ex.prevSets.length === 0) continue;

      for (let i = 0; i < Math.min(ex.sets.length, ex.prevSets.length); i++) {
        const s = ex.sets[i];
        if (!s.completed) continue;
        const userKg = parseFloat(s.kg) || 0;
        const userReps = parseInt(s.reps, 10) || 0;
        const result = compareGhostSet(userKg, userReps, ex.prevSets[i].kg, ex.prevSets[i].reps);
        if (result === 'win') wins++;
        else if (result === 'loss') losses++;
        else ties++;
      }
    }

    return { wins, losses, ties };
  }, [exercises, ghostUserName]);

  if (!tally || (tally.wins === 0 && tally.losses === 0 && tally.ties === 0)) return null;

  return (
    <View style={[
      styles.tally,
      { backgroundColor: tally.wins > tally.losses ? colors.positive + '15' : tally.losses > tally.wins ? colors.accentRed + '15' : colors.surface },
    ]}>
      <Text style={styles.tallyTitle}>
        SET SCORE
      </Text>
      <View style={styles.tallyRow}>
        <Text style={[styles.tallyName, { color: colors.positive }]}>
          You
        </Text>
        <Text style={[styles.tallyCount, { color: colors.positive }]}>
          {tally.wins}
        </Text>
        <Text style={styles.tallyDash}>
          —
        </Text>
        <Text style={[styles.tallyCount, { color: colors.textPrimary }]}>
          {tally.ties}
        </Text>
        <Text style={styles.tallyDash}>
          —
        </Text>
        <Text style={[styles.tallyCount, { color: colors.accentRed }]}>
          {tally.losses}
        </Text>
        <Text style={[styles.tallyName, { color: colors.accentRed }]}>
          {ghostUserName}
        </Text>
      </View>
    </View>
  );
});

/* ─── GhostSetChip (animated result) ─────────────────────── */

const GhostSetChip = React.memo(function GhostSetChip({
  index,
  ghostKg,
  ghostReps,
  result,
  colors,
  styles,
}: {
  index: number;
  ghostKg: number;
  ghostReps: number;
  result: 'win' | 'loss' | 'tie' | null;
  colors: ThemeColors;
  styles: GhostStyles;
}) {
  // Starts at the current result, so only a change buzzes (not the chips mounting when ghost focus moves)
  const prevResult = useRef<string | null>(result);

  useEffect(() => {
    if (result && prevResult.current !== result) {
      if (result === 'win') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result === 'loss') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    prevResult.current = result;
  }, [result]);

  const resultColor = result === 'win' ? colors.positive : result === 'loss' ? colors.accentRed : result === 'tie' ? colors.textPrimary : colors.textPrimary;
  const borderColor = result === 'win' ? colors.positive + '50' : result === 'loss' ? colors.accentRed + '50' : result === 'tie' ? colors.textPrimary + '30' : colors.cardBorder;
  const bgColor = result === 'win' ? colors.positive + '10' : result === 'loss' ? colors.accentRed + '10' : result === 'tie' ? colors.textPrimary + '08' : colors.card;
  const textColor = { color: result ? resultColor : colors.textPrimary };

  return (
    <View style={[styles.chip, { backgroundColor: bgColor, borderColor: borderColor }]}>
      <Text style={[styles.chipIndex, textColor]}>
        S{index + 1}
      </Text>
      <Text style={[styles.chipValue, textColor]}>
        {ghostKg}×{ghostReps}
      </Text>
    </View>
  );
});

/* ─── GhostSetsCard ───────────────────────────────────────── */
/* Ghost mode only: the friend's sets as chips, marked win/loss as you log.
   (Normal progressive overload lives in ExerciseProgressChart.) */

export const GhostSetsCard = React.memo(function GhostSetsCard({
  exercise,
}: {
  exercise: ActiveExercise;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ghostUserName = useActiveWorkoutStore((s) => s.ghostUserName);
  const prevSets = exercise.prevSets ?? [];
  if (!ghostUserName || prevSets.length === 0) return null;

  return (
    <View style={styles.setsCardWrap}>
      <View style={styles.setsCard}>
        <Text style={styles.setsCardTitle}>
          {ghostUserName}'s sets
        </Text>
        <View style={styles.chipRow}>
          {prevSets.map((ps, i) => {
            const userSet = exercise.sets[i];
            const completed = userSet?.completed;
            let result: 'win' | 'loss' | 'tie' | null = null;
            if (completed) {
              const uKg = parseFloat(userSet.kg) || 0;
              const uReps = parseInt(userSet.reps, 10) || 0;
              result = compareGhostSet(uKg, uReps, ps.kg, ps.reps);
            }
            return (
              <GhostSetChip
                key={i}
                index={i}
                ghostKg={ps.kg}
                ghostReps={ps.reps}
                result={result}
                colors={colors}
                styles={styles}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
});

/* ─── Styles ──────────────────────────────────────────────── */

type GhostStyles = ReturnType<typeof createStyles>;

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // GhostTally (background colour follows the score, set inline)
  tally: {
    alignItems: 'center',
    paddingVertical: sw(6),
    paddingHorizontal: sw(12),
    borderRadius: 0,
    marginHorizontal: sw(16),
    marginBottom: 0,
    gap: sw(2),
  },
  tallyTitle: { fontSize: ms(10), fontFamily: Fonts.semiBold, color: colors.textTertiary },
  tallyRow: { flexDirection: 'row', alignItems: 'center', gap: sw(6) },
  tallyName: { fontSize: ms(10), fontFamily: Fonts.semiBold },
  tallyCount: { fontSize: ms(14), fontFamily: Fonts.bold },
  tallyDash: { fontSize: ms(10), fontFamily: Fonts.medium, color: colors.textPrimary },

  // GhostSetChip (colours follow the result, set inline)
  chip: {
    borderWidth: 1,
    borderRadius: 0,
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
    alignItems: 'center',
    gap: sw(2),
    minWidth: sw(70),
  },
  chipIndex: {
    fontSize: ms(9),
    fontFamily: Fonts.bold,
  },
  chipValue: {
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },

  // GhostSetsCard
  setsCardWrap: { marginTop: sw(10) },
  setsCard: {
    backgroundColor: colors.surface,
    borderRadius: 0,
    padding: sw(10),
    gap: sw(4),
  },
  setsCardTitle: {
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    color: colors.accentRed,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sw(2),
    textAlign: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(6),
  },
});
