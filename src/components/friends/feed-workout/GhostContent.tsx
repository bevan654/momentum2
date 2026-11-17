import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import type { ActivityFeedItem } from '../../../lib/friendsDatabase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { safeDisplayName } from '../../../utils/displayName';
import { useStartFeedWorkout } from './useStartFeedWorkout';
import { titleCase } from '../../../utils/titleCase';
import { compareGhostSet } from '../../../utils/ghostCompare';
import { useSaveFeedRoutine } from './useSaveFeedRoutine';
import { formatHoursMinutes } from '../../../utils/formatDuration';

/* ── Ghost content ─────────────────────────────────── */

export function GhostContent({ item, onDismiss }: { item: ActivityFeedItem; onDismiss: () => void }) {
  const displayName = safeDisplayName(item.profile.username, item.profile.email);
  const exercises = item.exercise_details || [];
  const ghostExercises = item.ghost_exercises!;
  const ghostUserName = item.ghost_username!;
  const colors = useColors();

  const userId = useAuthStore((s) => s.user?.id);
  const isSelf = userId === item.user_id;

  const handleSaveRoutine = useSaveFeedRoutine(exercises, displayName);

  const startFeedWorkout = useStartFeedWorkout(onDismiss);
  const startChallenge = useCallback((targetName: string, targetExercises: { name: string; sets: { kg: number; reps: number }[] }[]) => {
    // Ghost exercises carry no type; the post's own exercise of the same name does.
    const postedTypes = new Map(exercises.map((ex) => [ex.name, ex.exercise_type]));
    startFeedWorkout(`feed-ghost-${item.id}`, targetName, targetExercises.map((ex) => ({
      name: ex.name,
      sets: ex.sets || [],
      setCount: ex.sets?.length || 3,
      postedType: postedTypes.get(ex.name),
    })));
  }, [item.id, exercises, startFeedWorkout]);

  const [showPicker, setShowPicker] = useState(false);

  const handlePickUser = useCallback((who: 'poster' | 'ghost') => {
    setShowPicker(false);
    if (who === 'poster') {
      const posterExercises = exercises.map((ex) => ({
        name: ex.name,
        sets: ex.sets || [],
      }));
      startChallenge(displayName, posterExercises);
    } else {
      startChallenge(ghostUserName, ghostExercises);
    }
  }, [displayName, ghostUserName, exercises, ghostExercises, startChallenge]);

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
      const userSets = ex.sets || [];
      const ghost = ghostMap[ex.name];
      const ghostSets = ghost?.sets ?? [];

      const userVol = userSets.reduce((sum, s) => sum + s.kg * s.reps, 0);
      const ghostVol = ghostSets.reduce((sum, s) => sum + s.kg * s.reps, 0);
      userTotalVol += userVol;
      ghostTotalVol += ghostVol;

      let exWins = 0;
      let exLosses = 0;
      let exTies = 0;
      const setResults: ('win' | 'loss' | 'tie')[] = [];
      const count = Math.min(userSets.length, ghostSets.length);
      for (let i = 0; i < count; i++) {
        const r = compareGhostSet(userSets[i].kg, userSets[i].reps, ghostSets[i].kg, ghostSets[i].reps);
        setResults.push(r);
        if (r === 'win') { exWins++; setWins++; }
        else if (r === 'loss') { exLosses++; setLosses++; }
        else { exTies++; setTies++; }
      }

      const name = titleCase(ex.name);
      return { name, userSets, ghostSets, setResults, exWins, exLosses, exTies };
    });

    // The post's own verdict is worked out at finish by each set's position in the workout (as the
    // live tally and the finish screen do); the feed only has completed sets, so recounting here can
    // disagree after a skipped set. Fall back to the recount for posts without one.
    const saved = item.ghost_result;
    const victory = saved ? saved === 'victory' : setWins > setLosses;
    const tied = saved ? saved === 'draw' : setWins === setLosses;
    return { perExercise, userTotalVol, ghostTotalVol, setWins, setLosses, setTies, victory, tied };
  }, [exercises, ghostMap, item.ghost_result]);

  const verdictColor = results.tied ? colors.textPrimary : results.victory ? colors.positive : colors.accentRed;
  const verdictText = results.tied ? 'DRAW' : results.victory ? 'VICTORY' : 'DEFEATED';

  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || ex.sets_count), 0);

  const gs = useMemo(() => createGhostStyles(colors), [colors]);

  return (
    <>
      <View style={gs.header}>
        <Text style={gs.title}>Challenge Summary</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={gs.scrollContent}>
        {/* Verdict */}
        <View style={gs.verdict}>
          <Text style={[gs.verdictText, { color: verdictColor }]}>
            {verdictText}
          </Text>
          <Text style={gs.verdictSub}>
            {displayName} vs {ghostUserName}
          </Text>
        </View>

        {/* Stats row */}
        <View style={gs.statsRow}>
          <Text style={gs.statText}>{formatHoursMinutes(item.duration)}</Text>
          <Text style={gs.statText}>·</Text>
          <Text style={gs.statText}>{exercises.length} exercises</Text>
          <Text style={gs.statText}>·</Text>
          <Text style={gs.statText}>{totalSets} sets</Text>
        </View>

        {/* Set Score Bar */}
        <View style={gs.scoreBlock}>
          <View style={gs.scoreLabels}>
            <Text style={gs.scoreWinsLabel}>{displayName}  {results.setWins}</Text>
            {results.setTies > 0 && (
              <Text style={gs.scoreTiedLabel}>{results.setTies} tied</Text>
            )}
            <Text style={gs.scoreLossesLabel}>{results.setLosses}  {ghostUserName}</Text>
          </View>
          <View style={gs.scoreBar}>
            {results.setWins > 0 && (
              <View style={[gs.scoreWins, { flex: results.setWins }]} />
            )}
            {results.setTies > 0 && (
              <View style={[gs.scoreTies, { flex: results.setTies }]} />
            )}
            {results.setLosses > 0 && (
              <View style={[gs.scoreLosses, { flex: results.setLosses }]} />
            )}
          </View>
        </View>

        {/* Head-to-head split */}
        {results.perExercise.map((ex, i) => (
          <View key={i} style={gs.exerciseBlock}>
            <Text style={gs.exerciseName} numberOfLines={1}>
              {ex.name}
            </Text>

            {/* Column headers */}
            <View style={gs.columnHeaders}>
              <Text style={gs.columnUser}>{displayName.toUpperCase()}</Text>
              <Text style={gs.columnSet}>SET</Text>
              <Text style={gs.columnGhost}>{ghostUserName.toUpperCase()}</Text>
            </View>

            {/* Set rows */}
            {ex.setResults.map((r, si) => {
              const userSet = ex.userSets[si];
              const ghostSet = ex.ghostSets[si];
              const bgColor = r === 'win' ? colors.positive + '12' : r === 'loss' ? colors.accentRed + '12' : 'transparent';
              return (
                <View key={si} style={[gs.setRow, { backgroundColor: bgColor }]}>
                  <Text style={gs.setUser}>
                    {userSet.kg} × {userSet.reps}
                  </Text>
                  <Text style={gs.setNumber}>
                    {si + 1}
                  </Text>
                  <Text style={gs.setGhost}>
                    {ghostSet.kg} × {ghostSet.reps}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={gs.footer}>
        {showPicker && (
          <View style={gs.pickerRow}>
            {!isSelf && (
              <TouchableOpacity style={gs.pickerPill} onPress={() => handlePickUser('poster')} activeOpacity={0.7}>
                <Text style={gs.pickerName}>{displayName}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={gs.pickerPill} onPress={() => handlePickUser('ghost')} activeOpacity={0.7}>
              <Text style={gs.pickerName}>{ghostUserName}</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={gs.footerRow}>
          <TouchableOpacity style={gs.saveBtn} onPress={handleSaveRoutine} activeOpacity={0.8}>
            <Ionicons name="bookmark-outline" size={ms(13)} color={colors.accent} />
            <Text style={gs.saveBtnText}>Save</Text>
          </TouchableOpacity>
          <TouchableOpacity style={gs.tryBtn} onPress={() => setShowPicker(!showPicker)} activeOpacity={0.8}>
            <Ionicons name="flash" size={ms(13)} color={colors.textOnAccent} />
            <Text style={gs.tryBtnText}>Beat This</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const createGhostStyles = (colors: ThemeColors) => StyleSheet.create({
  header: { paddingTop: sw(4), paddingBottom: sw(8), alignItems: 'center' },
  title: { fontSize: ms(15), fontFamily: Fonts.bold, color: colors.textPrimary },
  scrollContent: { padding: sw(16), paddingBottom: sw(32) },

  // Verdict (its colour follows the result, set inline)
  verdict: { alignItems: 'center', paddingVertical: sw(24), gap: sw(6) },
  verdictText: { fontSize: ms(34), fontFamily: Fonts.extraBold, letterSpacing: 2 },
  verdictSub: { fontSize: ms(12), fontFamily: Fonts.medium, color: colors.textTertiary },
  statsRow: { flexDirection: 'row', justifyContent: 'center', gap: sw(16), marginBottom: sw(16) },

  // Set score bar (segment flex follows the score, set inline)
  scoreBlock: { marginBottom: sw(36) },
  scoreLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: sw(6) },
  scoreWinsLabel: { fontSize: ms(12), fontFamily: Fonts.bold, color: colors.positive },
  scoreTiedLabel: { fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary },
  scoreLossesLabel: { fontSize: ms(12), fontFamily: Fonts.bold, color: colors.accentRed },
  scoreBar: { flexDirection: 'row', height: sw(6), borderRadius: sw(3), overflow: 'hidden' },
  scoreWins: { backgroundColor: colors.positive, borderTopLeftRadius: sw(3), borderBottomLeftRadius: sw(3) },
  scoreTies: { backgroundColor: colors.textTertiary + '40' },
  scoreLosses: { backgroundColor: colors.accentRed, borderTopRightRadius: sw(3), borderBottomRightRadius: sw(3) },

  // Head-to-head per exercise (row background follows the result, set inline)
  exerciseBlock: { marginBottom: sw(16) },
  exerciseName: {
    fontSize: ms(12), fontFamily: Fonts.bold, color: colors.textPrimary,
    textAlign: 'center', marginBottom: sw(8),
  },
  columnHeaders: {
    flexDirection: 'row', alignItems: 'center', paddingBottom: sw(6),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder,
  },
  columnUser: { flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary },
  columnSet: { width: sw(24), fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'center' },
  columnGhost: { flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right' },
  setRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: sw(8),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder,
  },
  setUser: { flex: 1, fontSize: ms(12), fontFamily: Fonts.semiBold, color: colors.textPrimary, paddingLeft: sw(4) },
  setNumber: { width: sw(24), fontSize: ms(10), fontFamily: Fonts.bold, color: colors.textTertiary, textAlign: 'center' },
  setGhost: { flex: 1, fontSize: ms(12), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right', paddingRight: sw(4) },

  statText: {
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    color: colors.textTertiary,
  },
  footer: {
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
    paddingBottom: sw(32),
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  footerRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(5),
    paddingVertical: sw(12),
    borderRadius: sw(10),
    borderWidth: 1,
    borderColor: colors.accent,
  },
  saveBtnText: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
  tryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(5),
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.accent,
  },
  tryBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    lineHeight: ms(16),
  },
  pickerRow: {
    flexDirection: 'row',
    gap: sw(8),
    marginBottom: sw(10),
  },
  // White pill, black text in both themes. Left as hex: the only tokens with these values in both
  // themes (textOnColor, backdrop) mean something else, so a change to them shouldn't move this.
  pickerPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: sw(10),
    paddingVertical: sw(10),
  },
  pickerName: {
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    color: '#000000',
  },
});
