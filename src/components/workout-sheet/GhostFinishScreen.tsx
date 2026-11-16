import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import type { WorkoutSummary } from '../../stores/useActiveWorkoutStore';
import { titleCase } from '../../utils/titleCase';
import { compareGhostSet } from '../../utils/ghostCompare';

/* ─── Component ────────────────────────────────────────── */

export default function GhostFinishScreen() {
  const showSummary = useActiveWorkoutStore((s) => s.showSummary);
  const summaryData = useActiveWorkoutStore((s) => s.summaryData);
  const dismissSummary = useActiveWorkoutStore((s) => s.dismissSummary);
  const colors = useColors();

  const isGhostFinish = showSummary && summaryData &&
    'ghostUserName' in summaryData && !!summaryData.ghostUserName && !!summaryData.ghostExercises;

  if (!isGhostFinish || !summaryData) return null;

  return (
    <GhostFinishContent
      summaryData={summaryData as WorkoutSummary}
      colors={colors}
      onDismiss={dismissSummary}
    />
  );
}

function GhostFinishContent({
  summaryData,
  colors,
  onDismiss,
}: {
  summaryData: WorkoutSummary;
  colors: ThemeColors;
  onDismiss: () => void;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ghostUserName = summaryData.ghostUserName!;
  const ghostExercises = summaryData.ghostExercises!;
  const exercises = summaryData.exercises;

  const ghostMap = useMemo(() => {
    const map: Record<string, { sets: { kg: number; reps: number }[] }> = {};
    for (const gex of ghostExercises) {
      map[gex.name] = { sets: gex.sets };
    }
    return map;
  }, [ghostExercises]);

  const results = useMemo(() => {
    let userTotalVol = 0;
    let ghostTotalVol = 0;
    let setWins = 0;
    let setLosses = 0;
    let setTies = 0;

    const perExercise = exercises.map((ex) => {
      const completedSets = ex.sets.filter((s) => s.completed);
      const ghost = ghostMap[ex.name];
      const ghostSets = ghost?.sets ?? [];

      const userVol = completedSets.reduce((sum, s) => sum + s.kg * s.reps, 0);
      const ghostVol = ghostSets.reduce((sum, s) => sum + s.kg * s.reps, 0);
      userTotalVol += userVol;
      ghostTotalVol += ghostVol;

      let exWins = 0;
      let exLosses = 0;
      let exTies = 0;
      const setResults: ('win' | 'loss' | 'tie')[] = [];
      const count = Math.min(completedSets.length, ghostSets.length);
      for (let i = 0; i < count; i++) {
        const r = compareGhostSet(completedSets[i].kg, completedSets[i].reps, ghostSets[i].kg, ghostSets[i].reps);
        setResults.push(r);
        if (r === 'win') { exWins++; setWins++; }
        else if (r === 'loss') { exLosses++; setLosses++; }
        else { exTies++; setTies++; }
      }

      const displayName = titleCase(ex.name);
      return { name: displayName, userVol, ghostVol, exWins, exLosses, exTies, setResults, completedSets, ghostSets };
    });

    const victory = setWins > setLosses;
    const tied = setWins === setLosses;
    return { perExercise, userTotalVol, ghostTotalVol, setWins, setLosses, setTies, victory, tied };
  }, [exercises, ghostMap]);

  const verdictColor = results.tied ? colors.textPrimary : results.victory ? colors.positive : colors.accentRed;
  const verdictText = results.tied ? 'DRAW' : results.victory ? 'VICTORY' : 'DEFEATED';

  const mins = Math.floor(summaryData.duration / 60);
  const secs = summaryData.duration % 60;
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const insets = useSafeAreaInsets();
  // Tab bar height: paddingTop sw(8) + icon ~24 + label ~12 + paddingBottom (insets.bottom)
  const tabBarHeight = sw(8) + ms(24) + ms(12) + insets.bottom + sw(8);

  return (
    <View style={[styles.root, { bottom: tabBarHeight }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Verdict */}
        <View style={styles.verdict}>
          <Text style={[styles.verdictText, { color: verdictColor }]}>
            {verdictText}
          </Text>
          <Text style={styles.verdictSub}>
            vs {ghostUserName}
          </Text>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Text style={styles.statText}>
            {mins}:{secs.toString().padStart(2, '0')}
          </Text>
          <Text style={styles.statText}>·</Text>
          <Text style={styles.statText}>
            {exercises.length} exercises
          </Text>
          <Text style={styles.statText}>·</Text>
          <Text style={styles.statText}>
            {totalSets} sets
          </Text>
        </View>

        {/* Set Score Bar */}
        <View style={styles.scoreBlock}>
          <View style={styles.scoreLabels}>
            <Text style={[styles.scoreSide, { color: colors.positive }]}>You  {results.setWins}</Text>
            {results.setTies > 0 && (
              <Text style={styles.scoreTied}>{results.setTies} tied</Text>
            )}
            <Text style={[styles.scoreSide, { color: colors.accentRed }]}>{results.setLosses}  {ghostUserName}</Text>
          </View>
          <View style={styles.scoreBar}>
            {results.setWins > 0 && (
              <View style={[styles.scoreWins, { flex: results.setWins }]} />
            )}
            {results.setTies > 0 && (
              <View style={[styles.scoreTies, { flex: results.setTies }]} />
            )}
            {results.setLosses > 0 && (
              <View style={[styles.scoreLosses, { flex: results.setLosses }]} />
            )}
          </View>
        </View>

        {/* Head-to-head split */}
        {results.perExercise.map((ex, i) => (
          <View key={i} style={styles.exerciseBlock}>
            {/* Exercise name centered */}
            <Text style={styles.exerciseName} numberOfLines={1}>
              {ex.name}
            </Text>

            {/* Column headers */}
            <View style={styles.columnHeaders}>
              <Text style={styles.columnYou}>YOU</Text>
              <Text style={styles.columnSet}>SET</Text>
              <Text style={styles.columnGhost}>{ghostUserName.toUpperCase()}</Text>
            </View>

            {/* Set rows */}
            {ex.setResults.map((r, si) => {
              const userSet = ex.completedSets[si];
              const ghostSet = ex.ghostSets[si];
              const bgColor = r === 'win' ? colors.positive + '12' : r === 'loss' ? colors.accentRed + '12' : 'transparent';
              return (
                <View key={si} style={[styles.setRow, { backgroundColor: bgColor }]}>
                  <Text style={styles.setUser}>
                    {userSet.kg} × {userSet.reps}
                  </Text>
                  <Text style={styles.setNumber}>
                    {si + 1}
                  </Text>
                  <Text style={styles.setGhost}>
                    {ghostSet.kg} × {ghostSet.reps}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Done button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.doneBtn}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark" size={ms(18)} color={colors.textOnAccent} />
          <Text style={styles.doneText}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  // bottom (above the tab bar) is set inline
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  scrollContent: { padding: sw(16), paddingBottom: sw(32) },

  verdict: { alignItems: 'center', paddingVertical: sw(24), gap: sw(6) },
  verdictText: {
    fontSize: ms(34),
    fontFamily: Fonts.extraBold,
    letterSpacing: 2,
  },
  verdictSub: {
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    color: colors.textTertiary,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sw(16),
    marginBottom: sw(16),
  },
  statText: { fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary },

  scoreBlock: { marginBottom: sw(36) },
  scoreLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sw(6) },
  scoreSide: { fontSize: ms(12), fontFamily: Fonts.bold },
  scoreTied: { fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary },
  scoreBar: { flexDirection: 'row', height: sw(6), borderRadius: sw(3), overflow: 'hidden' },
  scoreWins: { backgroundColor: colors.positive, borderTopLeftRadius: sw(3), borderBottomLeftRadius: sw(3) },
  scoreTies: { backgroundColor: colors.textTertiary + '40' },
  scoreLosses: { backgroundColor: colors.accentRed, borderTopRightRadius: sw(3), borderBottomRightRadius: sw(3) },

  exerciseBlock: { marginBottom: sw(16) },
  exerciseName: {
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: sw(8),
  },
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: sw(6),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  columnYou: { flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary },
  columnSet: { width: sw(24), fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'center' },
  columnGhost: { flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right' },
  // backgroundColor follows the set result, set inline
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(8),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  setUser: { flex: 1, fontSize: ms(12), fontFamily: Fonts.semiBold, color: colors.textPrimary, paddingLeft: sw(4) },
  setNumber: { width: sw(24), fontSize: ms(10), fontFamily: Fonts.bold, color: colors.textTertiary, textAlign: 'center' },
  setGhost: { flex: 1, fontSize: ms(12), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right', paddingRight: sw(4) },

  footer: {
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  doneBtn: {
    height: sw(44),
    borderRadius: sw(10),
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
  },
  doneText: { fontSize: ms(14), fontFamily: Fonts.bold, color: colors.textOnAccent },
});
