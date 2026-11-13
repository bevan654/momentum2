import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore, type ActiveExercise } from '../../stores/useActiveWorkoutStore';

/* ─── Ghost set comparison logic ─────────────────────────── */

/** Compare a single set: user vs ghost.
 *  - Weight decreased → loss
 *  - Same weight → compare reps
 *  - Weight increased → compare volume (kg×reps)
 */
function compareGhostSet(
  userKg: number, userReps: number,
  ghostKg: number, ghostReps: number,
): 'win' | 'loss' | 'tie' {
  if (userKg < ghostKg) return 'loss';
  if (userKg === ghostKg) {
    if (userReps > ghostReps) return 'win';
    if (userReps < ghostReps) return 'loss';
    return 'tie';
  }
  // Weight increased — compare volume
  const userVol = userKg * userReps;
  const ghostVol = ghostKg * ghostReps;
  if (userVol > ghostVol) return 'win';
  if (userVol < ghostVol) return 'loss';
  return 'tie';
}

/* ─── GhostTally ─────────────────────────────────────────── */

export const GhostTally = React.memo(function GhostTally({
  exercises,
}: {
  exercises: ActiveExercise[];
}) {
  const colors = useColors();
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
    <View style={{
      alignItems: 'center',
      paddingVertical: sw(6),
      paddingHorizontal: sw(12),
      backgroundColor: tally.wins > tally.losses ? '#34C759' + '15' : tally.losses > tally.wins ? colors.accentRed + '15' : colors.surface,
      borderRadius: 0,
      marginHorizontal: sw(16),
      marginBottom: 0,
      gap: sw(2),
    }}>
      <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: colors.textTertiary }}>
        SET SCORE
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sw(6) }}>
        <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: '#34C759' }}>
          You
        </Text>
        <Text style={{ fontSize: ms(14), fontFamily: Fonts.bold, color: '#34C759' }}>
          {tally.wins}
        </Text>
        <Text style={{ fontSize: ms(10), fontFamily: Fonts.medium, color: colors.textPrimary }}>
          —
        </Text>
        <Text style={{ fontSize: ms(14), fontFamily: Fonts.bold, color: colors.textPrimary }}>
          {tally.ties}
        </Text>
        <Text style={{ fontSize: ms(10), fontFamily: Fonts.medium, color: colors.textPrimary }}>
          —
        </Text>
        <Text style={{ fontSize: ms(14), fontFamily: Fonts.bold, color: colors.accentRed }}>
          {tally.losses}
        </Text>
        <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: colors.accentRed }}>
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
}: {
  index: number;
  ghostKg: number;
  ghostReps: number;
  result: 'win' | 'loss' | 'tie' | null;
  colors: ThemeColors;
}) {
  const prevResult = useRef<string | null>(null);

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

  const resultColor = result === 'win' ? '#34C759' : result === 'loss' ? colors.accentRed : result === 'tie' ? colors.textPrimary : colors.textPrimary;
  const borderColor = result === 'win' ? '#34C759' + '50' : result === 'loss' ? colors.accentRed + '50' : result === 'tie' ? colors.textPrimary + '30' : colors.cardBorder;
  const bgColor = result === 'win' ? '#34C759' + '10' : result === 'loss' ? colors.accentRed + '10' : result === 'tie' ? colors.textPrimary + '08' : colors.card;

  return (
    <View style={{
      backgroundColor: bgColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 0,
      paddingVertical: sw(6),
      paddingHorizontal: sw(10),
      alignItems: 'center',
      gap: sw(2),
      minWidth: sw(70),
    }}>
      <Text style={{
        fontSize: ms(9),
        fontFamily: Fonts.bold,
        color: result ? resultColor : colors.textPrimary,
      }}>
        S{index + 1}
      </Text>
      <Text style={{
        fontSize: ms(11),
        fontFamily: Fonts.semiBold,
        color: result ? resultColor : colors.textPrimary,
      }}>
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
  const ghostUserName = useActiveWorkoutStore((s) => s.ghostUserName);
  const prevSets = exercise.prevSets ?? [];
  if (!ghostUserName || prevSets.length === 0) return null;

  return (
    <View style={{ marginTop: sw(10) }}>
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: 0,
        padding: sw(10),
        gap: sw(4),
      }}>
        <Text style={{
          fontSize: ms(9),
          fontFamily: Fonts.semiBold,
          color: colors.accentRed,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          marginBottom: sw(2),
          textAlign: 'center',
        }}>
          {ghostUserName}'s sets
        </Text>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: sw(6),
        }}>
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
              />
            );
          })}
        </View>
      </View>
    </View>
  );
});
