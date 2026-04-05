import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, Modal, ScrollView, StyleSheet, Alert, TextInput, ActivityIndicator, Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, useAnimatedStyle, withDelay, withSpring, withTiming, Easing, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_HEIGHT } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { getUICategoryColor } from '../../constants/muscles';
import MuscleHeatmap from '../body/MuscleHeatmap';
import DurationPickerModal from './DurationPickerModal';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { supabase } from '../../lib/supabase';
import { useActiveWorkoutStore, type WorkoutSummary, type SummaryExercise, type GhostExerciseData } from '../../stores/useActiveWorkoutStore';
import type { WorkoutWithDetails, ExerciseWithSets } from '../../stores/useWorkoutStore';
import ShareModal from '../share/ShareModal';
import WorkoutOverlay from '../dev/WorkoutOverlay';

// ── Edit-mode types ──────────────────────────────────

type EditSet = { kg: string; reps: string; completed: boolean; set_type: string };
type EditExercise = { name: string; category: string | null; exercise_type?: string; sets: EditSet[] };

type Props = {
  onDismiss: () => void;
  onDelete?: () => void;
  inline?: boolean;
} & (
  | { mode: 'just-completed'; data: WorkoutSummary }
  | { mode: 'historical'; data: WorkoutWithDetails }
);

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k`;
  return `${kg.toLocaleString()} kg`;
}

function formatTimeSecs(secs: number): string {
  if (secs <= 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const isTimedType = (t?: string) => t === 'duration';
const showsKg = (t?: string) => t === 'weighted' || t === 'weighted+bodyweight' || !t;

function formatWorkoutDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

function ExerciseDetailSection({ exercise, colors, styles, prevSets }: { exercise: ExerciseWithSets; colors: ThemeColors; styles: ReturnType<typeof createStyles>; prevSets?: { kg: number; reps: number }[] }) {
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
        return (
          <View key={s.id} style={styles.summarySetRow}>
            <Text style={[styles.summarySetNum, styles.colSet]}>{i + 1}</Text>
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

function SummaryExerciseSection({ exercise, colors, styles, prevSets }: { exercise: SummaryExercise; colors: ThemeColors; styles: ReturnType<typeof createStyles>; prevSets?: { kg: number; reps: number }[] }) {
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
        return (
          <View key={i} style={styles.summarySetRow}>
            <Text style={[styles.summarySetNum, styles.colSet]}>{i + 1}</Text>
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

// ── Editable exercise section ────────────────────────

function EditableExerciseSection({
  exercise,
  exIdx,
  canRemove,
  colors,
  styles,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
}: {
  exercise: EditExercise;
  exIdx: number;
  canRemove: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'kg' | 'reps', value: string) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveExercise: (exIdx: number) => void;
}) {
  const catColor = exercise.category ? getUICategoryColor(exercise.category) : colors.textTertiary;

  const SET_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    warmup: { label: 'W', color: colors.accentOrange },
    drop: { label: 'D', color: colors.accentPink },
    failure: { label: 'F', color: colors.accentRed },
  };

  return (
    <View style={styles.exerciseDetail}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
        <View style={{ flex: 1 }} />
        {canRemove && (
          <TouchableOpacity style={styles.removeExerciseBtn} onPress={() => onRemoveExercise(exIdx)} activeOpacity={0.6}>
            <Ionicons name="close-circle" size={ms(16)} color={colors.accentRed} />
          </TouchableOpacity>
        )}
      </View>

      {/* Column headers */}
      <View style={styles.setRow}>
        <View style={styles.setNumCol}>
          <Text style={styles.editColHeader}>#</Text>
        </View>
        {showsKg(exercise.exercise_type) && (
          <Text style={[styles.editColHeader, { flex: 1, textAlign: 'center' }]}>
            {exercise.exercise_type === 'weighted+bodyweight' ? '+kg' : 'kg'}
          </Text>
        )}
        {showsKg(exercise.exercise_type) && <View style={{ width: sw(14) }} />}
        <Text style={[styles.editColHeader, { flex: 1, textAlign: 'center' }]}>
          {isTimedType(exercise.exercise_type) ? 'secs' : 'reps'}
        </Text>
        <View style={styles.setStatusCol} />
      </View>

      {exercise.sets.map((s, i) => {
        const typeConfig = SET_TYPE_CONFIG[s.set_type || ''];
        return (
          <View key={i} style={styles.setRow}>
            <View style={styles.setNumCol}>
              {typeConfig ? (
                <Text style={[styles.setTypeLabel, { color: typeConfig.color }]}>{typeConfig.label}</Text>
              ) : (
                <Text style={styles.setNumber}>{i + 1}</Text>
              )}
            </View>
            {showsKg(exercise.exercise_type) && (
              <TextInput
                style={styles.editInput}
                value={s.kg}
                onChangeText={(v) => onUpdateSet(exIdx, i, 'kg', v)}
                keyboardType="decimal-pad"
                maxLength={6}
                selectTextOnFocus
                placeholderTextColor={colors.textTertiary}
                placeholder="0"
              />
            )}
            {showsKg(exercise.exercise_type) && <Text style={styles.setTimes}>&times;</Text>}
            <TextInput
              style={styles.editInput}
              value={s.reps}
              onChangeText={(v) => onUpdateSet(exIdx, i, 'reps', v)}
              keyboardType="number-pad"
              maxLength={isTimedType(exercise.exercise_type) ? 5 : 4}
              selectTextOnFocus
              placeholderTextColor={colors.textTertiary}
              placeholder="0"
            />
            <View style={styles.setStatusCol}>
              {exercise.sets.length > 1 ? (
                <TouchableOpacity onPress={() => onRemoveSet(exIdx, i)} activeOpacity={0.6}>
                  <Ionicons name="close" size={ms(12)} color={colors.accentRed + '90'} />
                </TouchableOpacity>
              ) : (
                <View style={styles.incompleteDot} />
              )}
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={styles.addSetBtn} onPress={() => onAddSet(exIdx)} activeOpacity={0.7}>
        <Ionicons name="add" size={ms(12)} color={colors.accent} />
        <Text style={styles.addSetBtnText}>Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ── Ghost set comparison logic ────────────────────── */

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

/* ── Ghost Comparison Section ──────────────────────── */

function GhostComparisonSection({
  exercises,
  ghostExercises,
  ghostUserName,
  colors,
}: {
  exercises: SummaryExercise[];
  ghostExercises: GhostExerciseData[];
  ghostUserName: string;
  colors: ThemeColors;
}) {
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

      return { name: ex.name, userVol, ghostVol, exWins, exLosses, exTies, setResults, completedSets, ghostSets };
    });

    const victory = setWins > setLosses;
    const tied = setWins === setLosses;
    return { perExercise, userTotalVol, ghostTotalVol, setWins, setLosses, setTies, victory, tied };
  }, [exercises, ghostMap]);

  const verdictColor = results.tied ? colors.textPrimary : results.victory ? '#34C759' : colors.accentRed;
  const verdictText = results.tied ? 'DRAW' : results.victory ? 'VICTORY' : 'DEFEATED';
  const userName = useAuthStore((s) => s.user?.user_metadata?.username || 'You');

  // Volume bar
  const totalVol = results.userTotalVol + results.ghostTotalVol;
  const userVolPct = totalVol > 0 ? (results.userTotalVol / totalVol) * 100 : 50;

  return (
    <View style={{ gap: sw(16) }}>
      {/* ── Verdict Banner ──────────────────────── */}
      <View style={{
        alignItems: 'center',
        paddingVertical: sw(20),
        gap: sw(6),
      }}>
        <Text style={{
          fontSize: ms(32),
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
          {userName} vs {ghostUserName}
        </Text>
      </View>

      {/* ── Set Score ───────────────────────────── */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: sw(12),
        padding: sw(16),
      }}>
        <Text style={{
          fontSize: ms(10),
          fontFamily: Fonts.semiBold,
          color: colors.textTertiary,
          textAlign: 'center',
          letterSpacing: 1,
          marginBottom: sw(10),
        }}>
          SET SCORE
        </Text>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary, marginBottom: sw(2) }}>
              {userName}
            </Text>
            <Text style={{ fontSize: ms(28), fontFamily: Fonts.extraBold, color: '#34C759' }}>
              {results.setWins}
            </Text>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: sw(12) }}>
            <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary, marginBottom: sw(2) }}>
              Ties
            </Text>
            <Text style={{ fontSize: ms(22), fontFamily: Fonts.bold, color: colors.textPrimary }}>
              {results.setTies}
            </Text>
          </View>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: ms(11), fontFamily: Fonts.medium, color: colors.textTertiary, marginBottom: sw(2) }}>
              {ghostUserName}
            </Text>
            <Text style={{ fontSize: ms(28), fontFamily: Fonts.extraBold, color: colors.accentRed }}>
              {results.setLosses}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Volume Bar ──────────────────────────── */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: sw(12),
        padding: sw(14),
        gap: sw(8),
      }}>
        <Text style={{
          fontSize: ms(10),
          fontFamily: Fonts.semiBold,
          color: colors.textTertiary,
          letterSpacing: 1,
          textAlign: 'center',
        }}>
          TOTAL VOLUME
        </Text>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: sw(4),
        }}>
          <Text style={{ fontSize: ms(14), fontFamily: Fonts.bold, color: colors.textPrimary }}>
            {results.userTotalVol.toLocaleString()} kg
          </Text>
          <Text style={{ fontSize: ms(14), fontFamily: Fonts.bold, color: colors.accentRed }}>
            {results.ghostTotalVol.toLocaleString()} kg
          </Text>
        </View>
        <View style={{
          flexDirection: 'row',
          height: sw(8),
          borderRadius: sw(4),
          overflow: 'hidden',
        }}>
          <View style={{
            width: `${userVolPct}%` as any,
            backgroundColor: '#34C759',
            borderTopLeftRadius: sw(4),
            borderBottomLeftRadius: sw(4),
          }} />
          <View style={{
            flex: 1,
            backgroundColor: colors.accentRed,
            borderTopRightRadius: sw(4),
            borderBottomRightRadius: sw(4),
          }} />
        </View>
      </View>

      {/* ── Per-Exercise Breakdown ──────────────── */}
      <View style={{
        backgroundColor: colors.surface,
        borderRadius: sw(12),
        padding: sw(14),
        gap: sw(12),
      }}>
        <Text style={{
          fontSize: ms(10),
          fontFamily: Fonts.semiBold,
          color: colors.textTertiary,
          letterSpacing: 1,
          textAlign: 'center',
        }}>
          EXERCISE BREAKDOWN
        </Text>
        {results.perExercise.map((ex, i) => {
          const exWon = ex.exWins > ex.exLosses;
          const exLost = ex.exLosses > ex.exWins;
          const exColor = exWon ? '#34C759' : exLost ? colors.accentRed : colors.textTertiary;
          return (
            <View key={i} style={{ gap: sw(6) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{
                  flex: 1,
                  fontSize: ms(12),
                  fontFamily: Fonts.semiBold,
                  color: colors.textPrimary,
                }} numberOfLines={1}>
                  {ex.name}
                </Text>
                <Text style={{
                  fontSize: ms(11),
                  fontFamily: Fonts.bold,
                  color: exColor,
                }}>
                  {ex.exWins}W — {ex.exTies}T — {ex.exLosses}L
                </Text>
              </View>
              {/* Set-by-set dots */}
              <View style={{ flexDirection: 'row', gap: sw(4) }}>
                {ex.setResults.map((r, si) => (
                  <View key={si} style={{
                    width: sw(22),
                    height: sw(22),
                    borderRadius: sw(4),
                    backgroundColor: r === 'win' ? '#34C759' + '20' : r === 'loss' ? colors.accentRed + '20' : colors.textPrimary + '15',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Text style={{
                      fontSize: ms(9),
                      fontFamily: Fonts.bold,
                      color: r === 'win' ? '#34C759' : r === 'loss' ? colors.accentRed : colors.textPrimary,
                    }}>
                      S{si + 1}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function AnimatedCheckmark({ colors, styles }: { colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(100, withSpring(1, { damping: 14, stiffness: 220 }));

    const t = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.checkCircle, animStyle]}>
      <Ionicons name="checkmark" size={ms(28)} color={colors.textOnAccent} />
    </Animated.View>
  );
}

export default function WorkoutSummaryModal(props: Props) {
  const { mode, data, onDismiss, onDelete, inline } = props;
  const isJustCompleted = mode === 'just-completed';
  const [deleting, setDeleting] = useState(false);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── Crossfade animation for historical modal ────
  const contentOpacity = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (!inline && mode === 'historical') {
      backdropOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.quad) });
      contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) });
    }
  }, []);

  const contentFadeStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const animatedDismiss = useCallback(() => {
    contentOpacity.value = withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) });
    backdropOpacity.value = withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }, () => {
      runOnJS(onDismiss)();
    });
  }, [onDismiss]);

  // ── Edit state ───────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editExercises, setEditExercises] = useState<EditExercise[]>([]);
  const [editDuration, setEditDuration] = useState(0);
  const [saving, setSaving] = useState(false);
  const [durationPickerVisible, setDurationPickerVisible] = useState(false);

  // Share modal + workout name
  const [showShare, setShowShare] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  // Local overrides after save so display updates without re-fetch
  const [savedDuration, setSavedDuration] = useState<number | null>(null);
  const [savedExercises, setSavedExercises] = useState<SummaryExercise[] | null>(null);

  const handleDelete = () => {
    Alert.alert(
      'Delete Workout',
      'Are you sure you want to delete this workout? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            onDelete?.();
          },
        },
      ],
    );
  };

  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const globalPrevMap = useWorkoutStore((s) => s.prevMap);
  const allWorkouts = useWorkoutStore((s) => s.workouts);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const userId = useAuthStore((s) => s.user?.id);

  // For just-completed, use the snapshot captured at finish time (immune to background refetches).
  // For historical mode, compute prev sets from the session *before* this workout.
  const prevMap = useMemo(() => {
    if (isJustCompleted) return (data as WorkoutSummary).prevMap ?? globalPrevMap;
    const viewed = data as WorkoutWithDetails;
    const viewedDate = new Date(viewed.created_at).getTime();
    // Find workouts older than the viewed one, newest first (allWorkouts is already sorted desc)
    const older = allWorkouts.filter((w) => new Date(w.created_at).getTime() < viewedDate);
    const map: Record<string, { kg: number; reps: number }[]> = {};
    for (const w of older) {
      for (const ex of w.exercises) {
        if (map[ex.name]) continue;
        const sets = ex.sets
          .filter((s) => s.completed)
          .sort((a, b) => a.set_number - b.set_number)
          .map((s) => ({ kg: Number(s.kg) || 0, reps: Number(s.reps) || 0 }));
        if (sets.length > 0) map[ex.name] = sets;
      }
    }
    return map;
  }, [isJustCompleted, data, allWorkouts, globalPrevMap]);

  // Resolve workout ID
  const workoutId = isJustCompleted
    ? (data as WorkoutSummary).workoutId
    : (data as WorkoutWithDetails).id;

  // Use saved overrides if available, otherwise use original data
  const displayDuration = savedDuration ?? data.duration;
  const totalVolume = isJustCompleted ? data.totalVolume : data.totalVolume;

  const displayExercises: SummaryExercise[] | null = savedExercises ?? (
    isJustCompleted ? (data as WorkoutSummary).exercises : null
  );

  const totalExercises = savedExercises
    ? savedExercises.length
    : (isJustCompleted ? data.totalExercises : (data as WorkoutWithDetails).total_exercises);
  const totalSets = savedExercises
    ? savedExercises.reduce((n, ex) => n + ex.sets.length, 0)
    : (isJustCompleted ? data.totalSets : (data as WorkoutWithDetails).completedSets);

  const displayVolume = savedExercises
    ? Math.round(savedExercises.reduce((v, ex) => v + ex.sets.reduce((sv, s) => sv + s.kg * s.reps, 0), 0))
    : totalVolume;

  // Top set: heaviest weight used across all exercises
  const topSet = useMemo(() => {
    const exs = savedExercises ?? (
      isJustCompleted ? (data as WorkoutSummary).exercises
        : (data as WorkoutWithDetails).exercises.map((ex) => ({
            name: ex.name, category: ex.category, exercise_type: ex.exercise_type || 'weighted',
            sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed, set_type: s.set_type || 'working' })),
          }))
    );
    let bestKg = 0;
    let bestReps = 0;
    for (const ex of exs) {
      for (const s of ex.sets) {
        if (s.completed && s.kg > bestKg) {
          bestKg = s.kg;
          bestReps = s.reps;
        }
      }
    }
    return bestKg > 0 ? { kg: bestKg, reps: bestReps } : null;
  }, [savedExercises, data, isJustCompleted]);

  // ── Edit handlers ────────────────────────────────

  const startEditing = useCallback(() => {
    let exercises: EditExercise[];
    if (isJustCompleted) {
      const src = displayExercises ?? (data as WorkoutSummary).exercises;
      exercises = src.map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type,
        sets: ex.sets.map((s) => ({
          kg: String(s.kg),
          reps: String(s.reps),
          completed: s.completed,
          set_type: s.set_type,
        })),
      }));
    } else {
      exercises = (data as WorkoutWithDetails).exercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type,
        sets: ex.sets.map((s) => ({
          kg: String(s.kg),
          reps: String(s.reps),
          completed: s.completed,
          set_type: s.set_type || 'working',
        })),
      }));
    }
    setEditExercises(exercises);
    setEditDuration(displayDuration);
    setEditing(true);
  }, [data, isJustCompleted, displayDuration, displayExercises]);

  const cancelEditing = useCallback(() => {
    setEditing(false);
    setEditExercises([]);
  }, []);

  const updateEditSet = useCallback((exIdx: number, setIdx: number, field: 'kg' | 'reps', value: string) => {
    setEditExercises((prev) => {
      const next = prev.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) => (si === setIdx ? { ...s, [field]: value } : s)),
        };
      });
      return next;
    });
  }, []);

  const removeEditSet = useCallback((exIdx: number, setIdx: number) => {
    setEditExercises((prev) => prev.map((ex, ei) => {
      if (ei !== exIdx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
    }));
  }, []);

  const addEditSet = useCallback((exIdx: number) => {
    setEditExercises((prev) => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      return { ...ex, sets: [...ex.sets, { kg: '', reps: '', completed: true, set_type: 'working' }] };
    }));
  }, []);

  const removeEditExercise = useCallback((exIdx: number) => {
    setEditExercises((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== exIdx);
    });
  }, []);

  const saveEdits = useCallback(async () => {
    if (!workoutId || !userId) return;
    setSaving(true);

    try {
      // Filter out empty sets
      const cleanedExercises = editExercises
        .map((ex) => ({
          ...ex,
          sets: ex.sets.filter((s) => s.kg.trim() !== '' || s.reps.trim() !== ''),
        }))
        .filter((ex) => ex.sets.length > 0);

      if (cleanedExercises.length === 0) {
        Alert.alert('Error', 'At least one exercise with valid sets is required.');
        setSaving(false);
        return;
      }

      const newTotalSets = cleanedExercises.reduce((n, ex) => n + ex.sets.length, 0);

      // 1. Update workout row
      const { error: wErr } = await supabase
        .from('workouts')
        .update({
          duration: editDuration,
          total_exercises: cleanedExercises.length,
          total_sets: newTotalSets,
        })
        .eq('id', workoutId);

      if (wErr) throw wErr;

      // 2. Delete existing exercises (sets cascade via FK)
      const { error: delErr } = await supabase
        .from('exercises')
        .delete()
        .eq('workout_id', workoutId);

      if (delErr) throw delErr;

      // 3. Re-insert exercises + sets
      for (let i = 0; i < cleanedExercises.length; i++) {
        const ex = cleanedExercises[i];
        const exerciseType = catalogMap[ex.name]?.exercise_type || 'weighted';

        const { data: exData, error: exErr } = await supabase
          .from('exercises')
          .insert({
            workout_id: workoutId,
            name: ex.name,
            exercise_order: i + 1,
            exercise_type: exerciseType,
          })
          .select('id')
          .single();

        if (exErr || !exData) continue;

        const setRows = ex.sets.map((s, j) => ({
          exercise_id: exData.id,
          set_number: j + 1,
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
          set_type: s.set_type,
        }));

        if (setRows.length > 0) {
          await supabase.from('sets').insert(setRows);
        }
      }

      // 4. Update activity_feed
      const newVolume = Math.round(
        cleanedExercises.reduce((v, ex) =>
          v + ex.sets.reduce((sv, s) => sv + (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0), 0), 0)
      );
      const exerciseNames = cleanedExercises.map((ex) => ex.name);

      await supabase
        .from('activity_feed')
        .update({
          duration: editDuration,
          total_volume: newVolume,
          exercise_names: exerciseNames,
          total_exercises: cleanedExercises.length,
          total_sets: newTotalSets,
        })
        .eq('workout_id', workoutId);

      // 5. Build display overrides
      const newSummaryExercises: SummaryExercise[] = cleanedExercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type || 'weighted',
        sets: ex.sets.map((s) => ({
          kg: parseFloat(s.kg) || 0,
          reps: parseInt(s.reps, 10) || 0,
          completed: s.completed,
          set_type: s.set_type,
        })),
      }));

      setSavedDuration(editDuration);
      setSavedExercises(newSummaryExercises);

      // 6. Refresh workout history cache
      fetchWorkoutHistory(userId).catch(() => {});

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  }, [workoutId, userId, editExercises, editDuration, catalogMap, fetchWorkoutHistory]);

  const handleDurationConfirm = useCallback((seconds: number) => {
    setEditDuration(seconds);
    setDurationPickerVisible(false);
  }, []);

  /* ── Shared inner content ───────────────────────────── */

  const statsContent = editing ? (
    <View style={styles.statsRow}>
      <TouchableOpacity style={styles.statItem} onPress={() => setDurationPickerVisible(true)} activeOpacity={0.7}>
        <Text style={styles.statValue}>{formatDuration(editDuration)}</Text>
        <Text style={styles.durationEditHint}>tap to edit</Text>
      </TouchableOpacity>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{editExercises.length}</Text>
        <Text style={styles.statLabel}>Exercises</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{editExercises.reduce((n, ex) => n + ex.sets.length, 0)}</Text>
        <Text style={styles.statLabel}>Sets</Text>
      </View>
    </View>
  ) : (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatDuration(displayDuration)}</Text>
        <Text style={styles.statLabel}>Duration</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatVolume(displayVolume)}</Text>
        <Text style={styles.statLabel}>Volume</Text>
      </View>
      {topSet && (
        <>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{topSet.kg}×{topSet.reps}</Text>
            <Text style={styles.statLabel}>Top Set</Text>
          </View>
        </>
      )}
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalExercises}</Text>
        <Text style={styles.statLabel}>Exercises</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{totalSets}</Text>
        <Text style={styles.statLabel}>Sets</Text>
      </View>
    </View>
  );

  const exerciseContent = editing ? (
    <View style={styles.exerciseDetailList}>
      {editExercises.map((ex, i) => (
        <EditableExerciseSection
          key={i}
          exercise={ex}
          exIdx={i}
          canRemove={editExercises.length > 1}
          colors={colors}
          styles={styles}
          onUpdateSet={updateEditSet}
          onRemoveSet={removeEditSet}
          onAddSet={addEditSet}
          onRemoveExercise={removeEditExercise}
        />
      ))}
    </View>
  ) : isJustCompleted ? (
    <View style={styles.exerciseDetailList}>
      {(displayExercises ?? (data as WorkoutSummary).exercises).map((ex, i) => (
        <SummaryExerciseSection key={i} exercise={ex} colors={colors} styles={styles} prevSets={prevMap[ex.name]} />
      ))}
    </View>
  ) : (
    <View style={styles.exerciseDetailList}>
      {(data as WorkoutWithDetails).exercises.map((ex) => (
        <ExerciseDetailSection key={ex.id} exercise={ex} colors={colors} styles={styles} prevSets={prevMap[ex.name]} />
      ))}
    </View>
  );

  const editFooter = (
    <View style={styles.footerRow}>
      <TouchableOpacity style={styles.cancelEditBtn} onPress={cancelEditing} activeOpacity={0.7} disabled={saving}>
        <Text style={styles.cancelEditBtnText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.saveEditBtn} onPress={saveEdits} activeOpacity={0.7} disabled={saving}>
        {saving ? (
          <ActivityIndicator size="small" color={colors.textOnAccent} />
        ) : (
          <Text style={styles.saveEditBtnText}>Save</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const shareData = {
    exercises: displayExercises ?? (
      isJustCompleted
        ? (data as WorkoutSummary).exercises
        : (data as WorkoutWithDetails).exercises.map((ex) => ({
            name: ex.name,
            category: ex.category,
            exercise_type: ex.exercise_type || 'weighted',
            sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed, set_type: s.set_type || 'working' })),
          }))
    ),
    duration: displayDuration,
    date: isJustCompleted ? new Date() : new Date((data as WorkoutWithDetails).created_at),
    workoutName: workoutName.trim() || null,
    catalogMap,
  };

  const subModals = (
    <>
      {durationPickerVisible && (
        <DurationPickerModal
          visible
          onConfirm={handleDurationConfirm}
          onCancel={() => setDurationPickerVisible(false)}
        />
      )}
      {showShare && (
        <ShareModal visible={showShare} onClose={() => setShowShare(false)}>
          {({ imageUri }) => <WorkoutOverlay backgroundUri={imageUri} data={shareData} />}
        </ShareModal>
      )}
    </>
  );

  /* ── Historical mode: full-screen slide page ─────── */

  if (!isJustCompleted) {
    const historicalContent = (
      <>
        <HistoricalPage
          data={data as WorkoutWithDetails}
          colors={colors}
          styles={styles}
          editing={editing}
          onDismiss={inline ? onDismiss : animatedDismiss}
          onDelete={onDelete}
          handleDelete={handleDelete}
          deleting={deleting}
          startEditing={startEditing}
          workoutId={workoutId}
          statsContent={statsContent}
          exerciseContent={exerciseContent}
          editFooter={editFooter}
          saving={saving}
          setShowShare={setShowShare}
          inline={inline}
        />
        {subModals}
      </>
    );

    if (inline) return historicalContent;

    return (
      <Modal
        visible
        transparent
        statusBarTranslucent
        onRequestClose={animatedDismiss}
      >
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }, backdropAnimStyle]}>
            <TouchableWithoutFeedback onPress={animatedDismiss}>
              <View style={StyleSheet.absoluteFill} />
            </TouchableWithoutFeedback>
          </Animated.View>
          <Animated.View style={[{ flex: 1, marginTop: SCREEN_HEIGHT * 0.08 }, contentFadeStyle]}>
            <View style={{ flex: 1, borderTopLeftRadius: sw(20), borderTopRightRadius: sw(20), overflow: 'hidden', backgroundColor: colors.background }}>
              {historicalContent}
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  /* ── Just-completed mode ──────────────────────────── */

  const justCompletedContent = (
    <View style={inline ? styles.inlinePage : styles.modal}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {editing ? (
          <View style={styles.header}>
            <Text style={styles.title}>Edit Workout</Text>
          </View>
        ) : (
          <>
            <View style={styles.header}>
              <AnimatedCheckmark colors={colors} styles={styles} />
              <Text style={styles.title}>Workout Complete!</Text>
            </View>

            {statsContent}

            {!editing && (displayExercises ?? (data as WorkoutSummary).exercises).length > 0 && (
              <View style={styles.heatmapSmall}>
                <MuscleHeatmap exercises={(displayExercises ?? (data as WorkoutSummary).exercises) as any} embedded compact />
              </View>
            )}

            {exerciseContent}
          </>
        )}
      </ScrollView>

      {editing ? editFooter : (
        <View style={styles.footerRow}>
          <TouchableOpacity style={styles.smallIconBtn} onPress={() => useActiveWorkoutStore.getState().undoFinish()} activeOpacity={0.7}>
            <Ionicons name="pencil" size={ms(18)} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtnMain} onPress={() => setShowShare(true)} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={ms(18)} color={colors.textOnAccent} />
            <Text style={styles.shareBtnMainText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallIconBtn} onPress={onDismiss} activeOpacity={0.7}>
            <Ionicons name="checkmark" size={ms(18)} color={colors.accentGreen} />
          </TouchableOpacity>
        </View>
      )}
      {subModals}
    </View>
  );

  if (inline) return justCompletedContent;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={editing ? undefined : onDismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        {justCompletedContent}
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   HistoricalPage — full-screen workout detail page
   ═══════════════════════════════════════════════════════════ */

function HistoricalPage({
  data, colors, styles, editing, onDismiss, onDelete, handleDelete, deleting,
  startEditing, workoutId, statsContent, exerciseContent,
  editFooter, saving, setShowShare, inline,
}: {
  data: WorkoutWithDetails;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  editing: boolean;
  onDismiss: () => void;
  onDelete?: () => void;
  handleDelete: () => void;
  deleting: boolean;
  startEditing: () => void;
  workoutId: string | undefined;
  statsContent: React.ReactNode;
  exerciseContent: React.ReactNode;
  editFooter: React.ReactNode;
  saving: boolean;
  setShowShare: (v: boolean) => void;
  inline?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const ps = useMemo(() => pageStyles(colors), [colors]);

  return (
    <View style={[ps.container, !inline && { paddingTop: insets.top }]}>
      {/* Drag handle */}
      {!inline && (
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.8}>
          <View style={{ alignSelf: 'center', paddingVertical: sw(10) }}>
            <View style={{ width: sw(40), height: sw(5), borderRadius: sw(3), backgroundColor: colors.textTertiary, opacity: 0.5 }} />
          </View>
        </TouchableOpacity>
      )}
      <View style={[ps.pageHeader, inline && { paddingVertical: 0 }]}>
        <TouchableOpacity onPress={onDismiss} style={ps.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={ps.pageHeaderCenter}>
          <Text style={ps.pageTitle} numberOfLines={1}>
            {editing ? 'Edit Workout' : (data as WorkoutWithDetails).programName || 'Workout'}
          </Text>
          {!editing && (
            <Text style={ps.pageDate}>{formatWorkoutDate(data.created_at)}</Text>
          )}
        </View>
        <View style={ps.backBtn} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ps.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {statsContent}

        {!editing && data.exercises.length > 0 && (
          <View style={styles.heatmapSmall}>
            <MuscleHeatmap exercises={data.exercises} embedded compact />
          </View>
        )}

        {exerciseContent}
      </ScrollView>

      {/* Footer */}
      <View style={[ps.footer, !inline && { paddingBottom: Math.max(insets.bottom, sw(12)) }, inline && ps.footerInline]}>
        {editing ? editFooter : (
          <View style={styles.footerRow}>
            {onDelete && (
              <TouchableOpacity style={styles.inlineBtn} onPress={handleDelete} activeOpacity={0.7} disabled={deleting}>
                <Ionicons name="trash-outline" size={ms(16)} color={colors.accentRed} />
                <Text style={[styles.inlineBtnText, { color: colors.accentRed }]}>Delete</Text>
              </TouchableOpacity>
            )}
            {workoutId && (
              <TouchableOpacity style={styles.inlineBtn} onPress={startEditing} activeOpacity={0.7}>
                <Ionicons name="pencil" size={ms(16)} color={colors.accent} />
                <Text style={[styles.inlineBtnText, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.inlineBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={ms(16)} color={colors.accentGreen} />
              <Text style={[styles.inlineBtnText, { color: colors.accentGreen }]}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: sw(18),
    padding: sw(16),
    width: '90%',
    maxHeight: '82%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  inlinePage: {
    flex: 1,
    backgroundColor: colors.background,
    padding: sw(16),
  },
  closeBtn: {
    position: 'absolute',
    top: sw(12),
    right: sw(12),
    zIndex: 10,
    width: sw(28),
    height: sw(28),
    borderRadius: sw(14),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: sw(4),
  },

  /* -- Header -------------------------------- */
  header: {
    alignItems: 'center',
    marginBottom: sw(12),
    marginTop: sw(4),
    gap: sw(6),
  },
  checkCircle: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(20),
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
  },
  dateSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    marginTop: sw(-2),
  },
  workoutNameInput: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(8),
    paddingHorizontal: sw(16),
    alignSelf: 'stretch',
    marginTop: sw(4),
  },

  /* -- Tags (PR + muscle pills) -------------- */
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(6),
    marginBottom: sw(12),
    zIndex: 2,
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentOrange + '18',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    gap: sw(4),
  },
  prBadgeText: {
    color: colors.accentOrange,
    fontSize: ms(10),
    fontFamily: Fonts.bold,
    lineHeight: ms(14),
    letterSpacing: 0.3,
  },
  musclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    gap: sw(4),
  },
  muscleDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
  },
  muscleText: {
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },

  /* -- Stats row ----------------------------- */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(6),
    marginBottom: sw(14),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(1),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(20),
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(22),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    lineHeight: ms(13),
    letterSpacing: 0.3,
  },

  /* -- Exercise pills (just-completed) ------- */
  exerciseList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(6),
    marginBottom: sw(8),
  },
  exercisePill: {
    backgroundColor: colors.surface,
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    borderRadius: sw(8),
  },
  exercisePillText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },

  /* -- Exercise detail (historical) ---------- */
  exerciseDetailList: {
    width: '100%',
    gap: sw(8),
    marginBottom: sw(8),
  },
  heatmapSmall: {
    alignSelf: 'center',
    marginBottom: sw(8),
    transform: [{ scale: 0.75 }],
    marginTop: sw(-20),
    marginHorizontal: sw(-20),
  },
  exerciseDetail: {
    backgroundColor: colors.surface,
    paddingVertical: sw(8),
    paddingHorizontal: sw(10),
    overflow: 'hidden',
  },
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
  completedCount: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },

  /* -- Set rows ------------------------------ */
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(4),
    paddingHorizontal: sw(4),
    borderRadius: sw(4),
  },
  setRowPR: {
    backgroundColor: colors.accentOrange + '10',
  },
  setNumCol: {
    width: sw(22),
    alignItems: 'center',
  },
  setNumber: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  setTypeLabel: {
    fontSize: ms(11),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(15),
  },
  setText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    flex: 1,
    textAlign: 'center',
  },
  setTimes: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
    marginHorizontal: sw(2),
  },
  setStatusCol: {
    width: sw(20),
    alignItems: 'center',
  },
  incompleteDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.textTertiary + '40',
  },

  /* -- Edit mode inputs ---------------------- */
  editInput: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    textAlign: 'center',
    paddingVertical: sw(4),
    paddingHorizontal: sw(6),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: sw(28),
  },
  editColHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },
  removeExerciseBtn: {
    padding: sw(4),
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(4),
    paddingVertical: sw(6),
    marginTop: sw(4),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderStyle: 'dashed',
  },
  addSetBtnText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },
  durationEditHint: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },

  /* -- Footer buttons ------------------------ */
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginTop: sw(6),
  },
  deleteBtn: {
    width: sw(44),
    height: sw(44),
    backgroundColor: colors.accentRed + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBtn: {
    width: sw(44),
    height: sw(44),
    backgroundColor: colors.accent + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtn: {
    width: sw(44),
    height: sw(44),
    backgroundColor: colors.accentGreen + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
  },
  inlineBtnText: {
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  smallIconBtn: {
    width: sw(40),
    height: sw(40),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    backgroundColor: colors.accent,
    paddingVertical: sw(12),
  },
  shareBtnMainText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    letterSpacing: 0.3,
  },
  doneBtn: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  doneBtnGreen: {
    backgroundColor: colors.accentGreen,
  },
  doneBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  cancelEditBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  cancelEditBtnText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(21),
  },
  saveEditBtn: {
    flex: 1,
    backgroundColor: colors.accentGreen,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  saveEditBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
});

/* ─── Page-mode styles (historical full-screen) ────── */

const pageStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
  },
  backBtn: {
    width: sw(36),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: sw(2),
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  pageDate: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  scrollContent: {
    padding: sw(16),
    paddingBottom: sw(20),
  },
  footer: {
    paddingHorizontal: sw(16),
    paddingTop: sw(12),
  },
  footerInline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: sw(12),
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
});
