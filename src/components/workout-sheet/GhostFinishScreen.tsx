import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import type { WorkoutSummary, GhostExerciseData } from '../../stores/useActiveWorkoutStore';

/* ─── Ghost set comparison ─────────────────────────────── */

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
  const userVol = userKg * userReps;
  const ghostVol = ghostKg * ghostReps;
  if (userVol > ghostVol) return 'win';
  if (userVol < ghostVol) return 'loss';
  return 'tie';
}

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

      const displayName = ex.name.replace(/\b\w/g, (c) => c.toUpperCase());
      return { name: displayName, userVol, ghostVol, exWins, exLosses, exTies, setResults, completedSets, ghostSets };
    });

    const victory = setWins > setLosses;
    const tied = setWins === setLosses;
    return { perExercise, userTotalVol, ghostTotalVol, setWins, setLosses, setTies, victory, tied };
  }, [exercises, ghostMap]);

  const verdictColor = results.tied ? colors.textPrimary : results.victory ? '#34C759' : colors.accentRed;
  const verdictText = results.tied ? 'DRAW' : results.victory ? 'VICTORY' : 'DEFEATED';

  const totalVol = results.userTotalVol + results.ghostTotalVol;
  const userVolPct = totalVol > 0 ? (results.userTotalVol / totalVol) * 100 : 50;

  const mins = Math.floor(summaryData.duration / 60);
  const secs = summaryData.duration % 60;
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.completed).length, 0);
  const insets = useSafeAreaInsets();
  // Tab bar height: paddingTop sw(8) + icon ~24 + label ~12 + paddingBottom (insets.bottom)
  const tabBarHeight = sw(8) + ms(24) + ms(12) + insets.bottom + sw(8);

  return (
    <View style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: tabBarHeight,
      backgroundColor: colors.background,
    }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: sw(16), paddingBottom: sw(32) }}
      >
        {/* Verdict */}
        <View style={{ alignItems: 'center', paddingVertical: sw(24), gap: sw(6) }}>
          <Text style={{
            fontSize: ms(34),
            fontFamily: Fonts.extraBold,
            color: verdictColor,
            letterSpacing: 2,
          }}>
            {verdictText}
          </Text>
          <Text style={{
            fontSize: ms(12),
            fontFamily: Fonts.medium,
            color: colors.textTertiary,
          }}>
            vs {ghostUserName}
          </Text>
        </View>

        {/* Stats row */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: sw(16),
          marginBottom: sw(16),
        }}>
          <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>
            {mins}:{secs.toString().padStart(2, '0')}
          </Text>
          <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>·</Text>
          <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>
            {exercises.length} exercises
          </Text>
          <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>·</Text>
          <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>
            {totalSets} sets
          </Text>
        </View>

        {/* Set Score Bar */}
        <View style={{ marginBottom: sw(36) }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: sw(6) }}>
            <Text style={{ fontSize: ms(12), fontFamily: Fonts.bold, color: '#34C759' }}>You  {results.setWins}</Text>
            {results.setTies > 0 && (
              <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary }}>{results.setTies} tied</Text>
            )}
            <Text style={{ fontSize: ms(12), fontFamily: Fonts.bold, color: colors.accentRed }}>{results.setLosses}  {ghostUserName}</Text>
          </View>
          <View style={{ flexDirection: 'row', height: sw(6), borderRadius: sw(3), overflow: 'hidden' }}>
            {results.setWins > 0 && (
              <View style={{ flex: results.setWins, backgroundColor: '#34C759', borderTopLeftRadius: sw(3), borderBottomLeftRadius: sw(3) }} />
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
            {/* Exercise name centered */}
            <Text style={{
              fontSize: ms(12),
              fontFamily: Fonts.bold,
              color: colors.textPrimary,
              textAlign: 'center',
              marginBottom: sw(8),
            }} numberOfLines={1}>
              {ex.name}
            </Text>

            {/* Column headers */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingBottom: sw(6),
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.cardBorder,
            }}>
              <Text style={{ flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary }}>YOU</Text>
              <Text style={{ width: sw(24), fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'center' }}>SET</Text>
              <Text style={{ flex: 1, fontSize: ms(9), fontFamily: Fonts.semiBold, color: colors.textTertiary, textAlign: 'right' }}>{ghostUserName.toUpperCase()}</Text>
            </View>

            {/* Set rows */}
            {ex.setResults.map((r, si) => {
              const userSet = ex.completedSets[si];
              const ghostSet = ex.ghostSets[si];
              const bgColor = r === 'win' ? '#34C759' + '12' : r === 'loss' ? colors.accentRed + '12' : 'transparent';
              return (
                <View key={si} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: sw(8),
                  backgroundColor: bgColor,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.cardBorder,
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

      {/* Done button */}
      <View style={{
        paddingHorizontal: sw(16),
        paddingVertical: sw(12),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.cardBorder,
      }}>
        <TouchableOpacity
          style={{
            height: sw(44),
            borderRadius: sw(10),
            backgroundColor: colors.accent,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: sw(6),
          }}
          onPress={onDismiss}
          activeOpacity={0.7}
        >
          <Ionicons name="checkmark" size={ms(18)} color={colors.textOnAccent} />
          <Text style={{ fontSize: ms(14), fontFamily: Fonts.bold, color: colors.textOnAccent }}>Done</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
