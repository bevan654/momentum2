import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import type { ActivityFeedItem } from '../../../lib/friendsDatabase';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useRoutineStore } from '../../../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../../stores/useWorkoutStore';
import { confirmReplaceWorkout } from '../../../utils/confirmReplaceWorkout';
import { postedExerciseType, targetKg, routineSetTargets, compareGhostSet } from './feedWorkoutHelpers';

/* ── Ghost content ─────────────────────────────────── */

export function GhostContent({ item, onDismiss }: { item: ActivityFeedItem; onDismiss: () => void }) {
  const displayName = item.profile.username || item.profile.email;
  const exercises = item.exercise_details || [];
  const ghostExercises = item.ghost_exercises!;
  const ghostUserName = item.ghost_username!;
  const colors = useColors();

  const userId = useAuthStore((s) => s.user?.id);
  const isSelf = userId === item.user_id;
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);

  const handleSaveRoutine = useCallback(async () => {
    if (!userId) return;
    const routineExercises = exercises.map((ex, i) => ({
      name: ex.name,
      exercise_order: i + 1,
      default_sets: ex.sets_count || 3,
      default_reps: ex.best_reps || 10,
      default_rest_seconds: 90,
      ...routineSetTargets(ex),
      exercise_type: postedExerciseType(ex.name, ex.exercise_type, catalogMap),
    }));
    const { error } = await createRoutine(userId, `${displayName}'s Workout`, routineExercises);
    if (error) Alert.alert('Error', error);
    else Alert.alert('Saved', 'Routine saved to My Routines');
  }, [userId, exercises, displayName, createRoutine, catalogMap]);

  const startChallenge = useCallback((targetName: string, targetExercises: { name: string; sets: { kg: number; reps: number }[] }[]) => {
    const ghostPrevMap: Record<string, { kg: number; reps: number }[]> = {};
    for (const ex of targetExercises) {
      if (ex.sets && ex.sets.length > 0) {
        ghostPrevMap[ex.name] = ex.sets.map((s) => ({ kg: targetKg(s.kg), reps: s.reps }));
      }
    }
    // Ghost exercises carry no type; the post's own exercise of the same name does.
    const postedTypes = new Map(exercises.map((ex) => [ex.name, ex.exercise_type]));
    const routine = {
      id: `feed-ghost-${item.id}`,
      exercises: targetExercises.map((ex) => ({
        name: ex.name,
        default_sets: ex.sets?.length || 3,
        exercise_type: postedExerciseType(ex.name, postedTypes.get(ex.name), catalogMap),
      })),
    };
    // Close this sheet first and start the workout once its close animation has
    // played, so the workout sheet doesn't open underneath it.
    confirmReplaceWorkout(() => {
      onDismiss();
      setTimeout(() => startFromRoutine(routine, catalogMap, ghostPrevMap, targetName), 350);
    });
  }, [item.id, exercises, startFromRoutine, catalogMap, onDismiss]);

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

      const name = ex.name.replace(/\b\w/g, (c) => c.toUpperCase());
      return { name, userSets, ghostSets, setResults, exWins, exLosses, exTies };
    });

    const victory = setWins > setLosses;
    const tied = setWins === setLosses;
    return { perExercise, userTotalVol, ghostTotalVol, setWins, setLosses, setTies, victory, tied };
  }, [exercises, ghostMap]);

  const verdictColor = results.tied ? colors.textPrimary : results.victory ? colors.positive : colors.accentRed;
  const verdictText = results.tied ? 'DRAW' : results.victory ? 'VICTORY' : 'DEFEATED';

  const mins = Math.floor(item.duration / 60);
  const secs = item.duration % 60;
  const totalSets = exercises.reduce((sum, ex) => sum + (ex.sets?.length || ex.sets_count), 0);

  const gs = useMemo(() => createGhostStyles(colors), [colors]);

  return (
    <>
      <View style={{ paddingTop: sw(4), paddingBottom: sw(8), alignItems: 'center' }}>
        <Text style={{ fontSize: ms(15), fontFamily: Fonts.bold, color: colors.textPrimary }}>Challenge Summary</Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: sw(16), paddingBottom: sw(32) }}>
        {/* Verdict */}
        <View style={{ alignItems: 'center', paddingVertical: sw(24), gap: sw(6) }}>
          <Text style={{ fontSize: ms(34), fontFamily: Fonts.extraBold, color: verdictColor, letterSpacing: 2 }}>
            {verdictText}
          </Text>
          <Text style={{ fontSize: ms(12), fontFamily: Fonts.medium, color: colors.textTertiary }}>
            {displayName} vs {ghostUserName}
          </Text>
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: sw(16), marginBottom: sw(16) }}>
          <Text style={gs.statText}>{mins}:{secs.toString().padStart(2, '0')}</Text>
          <Text style={gs.statText}>·</Text>
          <Text style={gs.statText}>{exercises.length} exercises</Text>
          <Text style={gs.statText}>·</Text>
          <Text style={gs.statText}>{totalSets} sets</Text>
        </View>

        {/* Set Score Bar */}
        <View style={{ marginBottom: sw(36) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: sw(6) }}>
            <Text style={{ fontSize: ms(12), fontFamily: Fonts.bold, color: colors.positive }}>{displayName}  {results.setWins}</Text>
            {results.setTies > 0 && (
              <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>{results.setTies} tied</Text>
            )}
            <Text style={{ fontSize: ms(12), fontFamily: Fonts.bold, color: colors.accentRed }}>{results.setLosses}  {ghostUserName}</Text>
          </View>
          <View style={{ flexDirection: 'row', height: sw(6), borderRadius: sw(3), overflow: 'hidden' }}>
            {results.setWins > 0 && (
              <View style={{ flex: results.setWins, backgroundColor: colors.positive, borderTopLeftRadius: sw(3), borderBottomLeftRadius: sw(3) }} />
            )}
            {results.setTies > 0 && (
              <View style={{ flex: results.setTies, backgroundColor: colors.textTertiary + '40' }} />
            )}
            {results.setLosses > 0 && (
              <View style={{ flex: results.setLosses, backgroundColor: colors.accentRed, borderTopRightRadius: sw(3), borderBottomRightRadius: sw(3) }} />
            )}
          </View>
        </View>

        {/* Head-to-head split */}
        {results.perExercise.map((ex, i) => (
          <View key={i} style={{ marginBottom: sw(16) }}>
            <Text style={{
              fontSize: ms(12), fontFamily: Fonts.bold, color: colors.textPrimary,
              textAlign: 'center', marginBottom: sw(8),
            }} numberOfLines={1}>
              {ex.name}
            </Text>

            {/* Column headers */}
            <View style={{
              flexDirection: 'row', alignItems: 'center', paddingBottom: sw(6),
              borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder,
            }}>
              <Text style={{ flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary }}>{displayName.toUpperCase()}</Text>
              <Text style={{ width: sw(24), fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'center' }}>SET</Text>
              <Text style={{ flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right' }}>{ghostUserName.toUpperCase()}</Text>
            </View>

            {/* Set rows */}
            {ex.setResults.map((r, si) => {
              const userSet = ex.userSets[si];
              const ghostSet = ex.ghostSets[si];
              const bgColor = r === 'win' ? colors.positive + '12' : r === 'loss' ? colors.accentRed + '12' : 'transparent';
              return (
                <View key={si} style={{
                  flexDirection: 'row', alignItems: 'center', paddingVertical: sw(8),
                  backgroundColor: bgColor,
                  borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.cardBorder,
                }}>
                  <Text style={{ flex: 1, fontSize: ms(12), fontFamily: Fonts.semiBold, color: colors.textPrimary, paddingLeft: sw(4) }}>
                    {userSet.kg} × {userSet.reps}
                  </Text>
                  <Text style={{ width: sw(24), fontSize: ms(10), fontFamily: Fonts.bold, color: colors.textTertiary, textAlign: 'center' }}>
                    {si + 1}
                  </Text>
                  <Text style={{ flex: 1, fontSize: ms(12), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right', paddingRight: sw(4) }}>
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
