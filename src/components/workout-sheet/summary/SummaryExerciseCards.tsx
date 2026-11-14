import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { getUICategoryColor } from '../../../constants/muscles';
import type { SummaryExercise } from '../../../stores/useActiveWorkoutStore';
import type { ExerciseWithSets, CoachExerciseNote } from '../../../stores/useWorkoutStore';
import { formatTimeSecs, isTimedType, showsKg } from './summaryFormat';

/** Read-only card for an exercise of a saved workout (history). */
function ExerciseDetailSection({ exercise, colors, prevSets, coachNote }: { exercise: ExerciseWithSets; colors: ThemeColors; prevSets?: { kg: number; reps: number }[]; coachNote?: CoachExerciseNote }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catColor = exercise.category ? getUICategoryColor(exercise.category) : colors.textTertiary;
  const completedSets = exercise.sets.filter((s) => s.completed);
  const timed = isTimedType(exercise.exercise_type);
  const hasKg = showsKg(exercise.exercise_type);

  // Summary line
  const summaryLine = timed
    ? `${completedSets.length} sets · ${formatTimeSecs(completedSets.reduce((sum, s) => sum + s.reps, 0))} total`
    : `${completedSets.length} sets · ${completedSets.reduce((sum, s) => sum + s.reps, 0)} reps`;

  // Volume progression (skip for duration/bodyweight-only)
  const volume = hasKg ? completedSets.reduce((sum, s) => sum + s.kg * s.reps, 0) : 0;
  const prevVolume = hasKg && prevSets ? prevSets.reduce((sum, s) => sum + s.kg * s.reps, 0) : 0;
  const volDiff = hasKg && prevSets && prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;

  // Top weight comparison (skip for non-weighted)
  const topWeight = hasKg ? completedSets.reduce((max, s) => Math.max(max, s.kg), 0) : 0;
  const prevTopWeight = hasKg && prevSets ? prevSets.reduce((max, s) => Math.max(max, s.kg), 0) : 0;
  const weightDiff = hasKg && prevSets && prevTopWeight > 0 ? topWeight - prevTopWeight : null;

  // Duration total for timed exercises
  const totalTime = timed ? completedSets.reduce((sum, s) => sum + s.reps, 0) : 0;
  const prevTotalTime = timed && prevSets ? prevSets.reduce((sum, s) => sum + s.reps, 0) : 0;
  const timeDiff = timed && prevSets && prevTotalTime > 0 ? Math.round(((totalTime - prevTotalTime) / prevTotalTime) * 100) : null;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
          <Text style={styles.summaryExSummary}>{summaryLine}</Text>
        </View>
      </View>

      {/* Progression stats */}
      <View style={styles.progressionRow}>
        {hasKg ? (
          <>
            <View style={styles.progressionItem}>
              <Text style={styles.progressionLabel}>Vol</Text>
              <Text style={styles.progressionValue}>{volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : volume} kg</Text>
              {volDiff !== null && (
                <Text style={[styles.progressionDelta, volDiff >= 0 ? styles.deltaUp : styles.deltaDown]}>
                  {volDiff >= 0 ? '+' : ''}{volDiff}%
                </Text>
              )}
            </View>
            <View style={styles.progressionDivider} />
            <View style={styles.progressionItem}>
              <Text style={styles.progressionLabel}>Top</Text>
              <Text style={styles.progressionValue}>{topWeight} kg</Text>
              {weightDiff !== null && weightDiff !== 0 && (
                <Text style={[styles.progressionDelta, weightDiff > 0 ? styles.deltaUp : styles.deltaDown]}>
                  {weightDiff > 0 ? '+' : ''}{weightDiff} kg
                </Text>
              )}
            </View>
          </>
        ) : timed ? (
          <View style={styles.progressionItem}>
            <Text style={styles.progressionLabel}>Total</Text>
            <Text style={styles.progressionValue}>{formatTimeSecs(totalTime)}</Text>
            {timeDiff !== null && (
              <Text style={[styles.progressionDelta, timeDiff >= 0 ? styles.deltaUp : styles.deltaDown]}>
                {timeDiff >= 0 ? '+' : ''}{timeDiff}%
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.progressionItem}>
            <Text style={styles.progressionLabel}>Sets</Text>
            <Text style={styles.progressionValue}>{completedSets.length}</Text>
          </View>
        )}
      </View>

      {coachNote?.note ? (
        <Text style={styles.coachNote}>"{coachNote.note}"</Text>
      ) : null}

      <View style={styles.summaryDivider} />

      {/* Column headers */}
      <View style={styles.summaryColHeaders}>
        <Text style={[styles.summaryColHeader, styles.colSet]}>SET</Text>
        <Text style={[styles.summaryColHeader, styles.colPrev]}>PREV</Text>
        {hasKg && <Text style={[styles.summaryColHeader, styles.colVal]}>{exercise.exercise_type === 'weighted+bodyweight' ? '+KG' : 'KG'}</Text>}
        <Text style={[styles.summaryColHeader, styles.colVal]}>{timed ? 'TIME' : 'REPS'}</Text>
      </View>

      {/* Set rows */}
      {completedSets.map((s, i) => {
        const prev = prevSets?.[i];
        const isDropRow = s.set_type === 'drop' && s.parent_set_number != null;
        let dropLabel: string | null = null;
        if (isDropRow) {
          let count = 0;
          for (let j = 0; j < i; j++) {
            if (completedSets[j].set_type === 'drop' && completedSets[j].parent_set_number === s.parent_set_number) count++;
          }
          dropLabel = `D${count + 1}`;
        }
        return (
          <View key={s.id} style={[styles.summarySetRow, isDropRow && { marginLeft: sw(12) }]}>
            {isDropRow ? (
              <Text style={[styles.summarySetNum, styles.colSet, { color: colors.accentBabyBlue }]}>{dropLabel}</Text>
            ) : (
              <Text style={[styles.summarySetNum, styles.colSet]}>{i + 1}</Text>
            )}
            <Text style={[styles.summaryPrevText, styles.colPrev]}>
              {prev
                ? timed ? formatTimeSecs(prev.reps)
                : hasKg ? `${prev.kg}×${prev.reps}`
                : `${prev.reps}`
                : '—'}
            </Text>
            {hasKg && <Text style={[styles.summaryCellVal, styles.colVal]}>{s.kg}</Text>}
            <Text style={[styles.summaryCellVal, styles.colVal]}>{timed ? formatTimeSecs(s.reps) : s.reps}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** Read-only card for an exercise of a just-finished workout. */
function SummaryExerciseSection({ exercise, colors, prevSets, coachNote }: { exercise: SummaryExercise; colors: ThemeColors; prevSets?: { kg: number; reps: number }[]; coachNote?: CoachExerciseNote }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catColor = exercise.category ? getUICategoryColor(exercise.category) : colors.textTertiary;
  const completedSets = exercise.sets.filter((s) => s.completed);
  const timed = isTimedType(exercise.exercise_type);
  const hasKg = showsKg(exercise.exercise_type);

  const summaryLine = timed
    ? `${completedSets.length} sets · ${formatTimeSecs(completedSets.reduce((sum, s) => sum + s.reps, 0))} total`
    : `${completedSets.length} sets · ${completedSets.reduce((sum, s) => sum + s.reps, 0)} reps`;

  // Volume progression (skip for duration/bodyweight-only)
  const volume = hasKg ? completedSets.reduce((sum, s) => sum + s.kg * s.reps, 0) : 0;
  const prevVolume = hasKg && prevSets ? prevSets.reduce((sum, s) => sum + s.kg * s.reps, 0) : 0;
  const volDiff = hasKg && prevSets && prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;

  const topWeight = hasKg ? completedSets.reduce((max, s) => Math.max(max, s.kg), 0) : 0;
  const prevTopWeight = hasKg && prevSets ? prevSets.reduce((max, s) => Math.max(max, s.kg), 0) : 0;
  const weightDiff = hasKg && prevSets && prevTopWeight > 0 ? topWeight - prevTopWeight : null;

  const totalTime = timed ? completedSets.reduce((sum, s) => sum + s.reps, 0) : 0;
  const prevTotalTime = timed && prevSets ? prevSets.reduce((sum, s) => sum + s.reps, 0) : 0;
  const timeDiff = timed && prevSets && prevTotalTime > 0 ? Math.round(((totalTime - prevTotalTime) / prevTotalTime) * 100) : null;

  return (
    <View style={styles.summaryCard}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
          <Text style={styles.summaryExSummary}>{summaryLine}</Text>
        </View>
      </View>

      {/* Progression stats */}
      <View style={styles.progressionRow}>
        {hasKg ? (
          <>
            <View style={styles.progressionItem}>
              <Text style={styles.progressionLabel}>Vol</Text>
              <Text style={styles.progressionValue}>{volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : volume} kg</Text>
              {volDiff !== null && (
                <Text style={[styles.progressionDelta, volDiff >= 0 ? styles.deltaUp : styles.deltaDown]}>
                  {volDiff >= 0 ? '+' : ''}{volDiff}%
                </Text>
              )}
            </View>
            <View style={styles.progressionDivider} />
            <View style={styles.progressionItem}>
              <Text style={styles.progressionLabel}>Top</Text>
              <Text style={styles.progressionValue}>{topWeight} kg</Text>
              {weightDiff !== null && weightDiff !== 0 && (
                <Text style={[styles.progressionDelta, weightDiff > 0 ? styles.deltaUp : styles.deltaDown]}>
                  {weightDiff > 0 ? '+' : ''}{weightDiff} kg
                </Text>
              )}
            </View>
          </>
        ) : timed ? (
          <View style={styles.progressionItem}>
            <Text style={styles.progressionLabel}>Total</Text>
            <Text style={styles.progressionValue}>{formatTimeSecs(totalTime)}</Text>
            {timeDiff !== null && (
              <Text style={[styles.progressionDelta, timeDiff >= 0 ? styles.deltaUp : styles.deltaDown]}>
                {timeDiff >= 0 ? '+' : ''}{timeDiff}%
              </Text>
            )}
          </View>
        ) : (
          <View style={styles.progressionItem}>
            <Text style={styles.progressionLabel}>Sets</Text>
            <Text style={styles.progressionValue}>{completedSets.length}</Text>
          </View>
        )}
      </View>

      {coachNote?.note ? (
        <Text style={styles.coachNote}>"{coachNote.note}"</Text>
      ) : null}

      <View style={styles.summaryDivider} />

      {/* Column headers */}
      <View style={styles.summaryColHeaders}>
        <Text style={[styles.summaryColHeader, styles.colSet]}>SET</Text>
        <Text style={[styles.summaryColHeader, styles.colPrev]}>PREV</Text>
        {hasKg && <Text style={[styles.summaryColHeader, styles.colVal]}>{exercise.exercise_type === 'weighted+bodyweight' ? '+KG' : 'KG'}</Text>}
        <Text style={[styles.summaryColHeader, styles.colVal]}>{timed ? 'TIME' : 'REPS'}</Text>
      </View>

      {/* Set rows */}
      {completedSets.map((s, i) => {
        const prev = prevSets?.[i];
        const isDropRow = s.set_type === 'drop' && s.parent_set_number != null;
        // Compute drop ordinal
        let dropLabel: string | null = null;
        if (isDropRow) {
          let count = 0;
          for (let j = 0; j < i; j++) {
            if (completedSets[j].set_type === 'drop' && completedSets[j].parent_set_number === s.parent_set_number) count++;
          }
          dropLabel = `D${count + 1}`;
        }
        return (
          <View key={i} style={[styles.summarySetRow, isDropRow && { marginLeft: sw(12) }]}>
            {isDropRow ? (
              <Text style={[styles.summarySetNum, styles.colSet, { color: colors.accentBabyBlue }]}>{dropLabel}</Text>
            ) : (
              <Text style={[styles.summarySetNum, styles.colSet]}>{i + 1}</Text>
            )}
            <Text style={[styles.summaryPrevText, styles.colPrev]}>
              {prev
                ? timed ? formatTimeSecs(prev.reps)
                : hasKg ? `${prev.kg}×${prev.reps}`
                : `${prev.reps}`
                : '—'}
            </Text>
            {hasKg && <Text style={[styles.summaryCellVal, styles.colVal]}>{s.kg}</Text>}
            <Text style={[styles.summaryCellVal, styles.colVal]}>{timed ? formatTimeSecs(s.reps) : s.reps}</Text>
          </View>
        );
      })}
    </View>
  );
}

export const ExerciseDetailCard = React.memo(ExerciseDetailSection);
export const SummaryExerciseCard = React.memo(SummaryExerciseSection);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(4),
  },
  catStrip: {
    width: sw(3),
    height: sw(14),
    marginRight: sw(8),
  },
  exerciseDetailName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderWidth: sw(2),
    borderColor: colors.cardBorder,
    padding: sw(12),
    marginBottom: sw(10),
  },
  summaryExSummary: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sw(8),
    paddingVertical: sw(6),
    paddingHorizontal: sw(4),
    backgroundColor: colors.card,
  },
  progressionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(4),
  },
  progressionDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(14),
    backgroundColor: colors.cardBorder,
  },
  progressionLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  progressionValue: {
    color: colors.textPrimary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  progressionDelta: {
    fontSize: ms(9),
    fontFamily: Fonts.bold,
  },
  deltaUp: {
    color: '#34C759',
  },
  deltaDown: {
    color: colors.accentRed,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(8),
  },
  coachNote: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    marginTop: sw(8),
  },
  summaryColHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(2),
  },
  summaryColHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  colSet: {
    width: sw(30),
  },
  colPrev: {
    width: sw(60),
  },
  colVal: {
    flex: 1,
  },
  summarySetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  summarySetNum: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  summaryPrevText: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  summaryCellVal: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
});
