import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Pressable,
  Modal,
  StyleSheet,
  Keyboard,
  Platform,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withSequence,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { ActiveExercise } from '../../stores/useActiveWorkoutStore';
import WorkoutHeader from './WorkoutHeader';
import RestTimerBar from './RestTimerBar';
import ExerciseCard from './ExerciseCard';
import ExercisePicker from './ExercisePicker';

/* ─── Constants (computed once) ────────────────────────── */

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.round(SCREEN_H * 0.95);
const RADIUS = sw(20);
const HANDLE_W = sw(40);
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;
const BACKDROP_MAX = 0.6;

const OPEN_SPRING = { damping: 28, stiffness: 280, mass: 0.8 };
const SNAP_SPRING = { damping: 24, stiffness: 350, mass: 0.7 };
const CLOSE_CFG = { duration: 250, easing: Easing.in(Easing.cubic) };

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

const GhostTally = React.memo(function GhostTally({
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
  const scale = useSharedValue(result ? 1 : 0);
  const prevResult = useRef<string | null>(null);

  useEffect(() => {
    if (result && prevResult.current !== result) {
      scale.value = 0;
      scale.value = withSpring(1, { damping: 12, stiffness: 300 });
      if (result === 'win') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (result === 'loss') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    }
    prevResult.current = result;
  }, [result]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const resultColor = result === 'win' ? '#34C759' : result === 'loss' ? colors.accentRed : result === 'tie' ? colors.textPrimary : colors.textPrimary;
  const borderColor = result === 'win' ? '#34C759' + '50' : result === 'loss' ? colors.accentRed + '50' : result === 'tie' ? colors.textPrimary + '30' : colors.cardBorder;
  const bgColor = result === 'win' ? '#34C759' + '10' : result === 'loss' ? colors.accentRed + '10' : result === 'tie' ? colors.textPrimary + '08' : colors.card;
  const iconName = result === 'win' ? 'checkmark-circle' : result === 'loss' ? 'close-circle' : result === 'tie' ? 'remove-circle' : null;

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

/* ─── ProgressiveOverloadCard ─────────────────────────────── */

const ProgressiveOverloadCard = React.memo(function ProgressiveOverloadCard({
  exercises,
}: {
  exercises: ActiveExercise[];
}) {
  const colors = useColors();
  const ghostUserName = useActiveWorkoutStore((s) => s.ghostUserName);
  const isGhost = !!ghostUserName;

  const overload = useMemo(() => {
    const ex = exercises[0];
    if (!ex || ex.prevSets.length === 0) return null;

    const prevSetVols = ex.prevSets.map((s) => s.kg * s.reps);
    const prevTotal = prevSetVols.reduce((a, b) => a + b, 0);
    if (prevTotal <= 0) return null;

    const segments: number[] = [];
    let cumul = 0;
    for (const vol of prevSetVols) {
      cumul += vol;
      segments.push(cumul / prevTotal);
    }

    const completedSets = ex.sets.filter((s) => s.completed);
    const completedCount = completedSets.length;
    const currentVol = completedSets.reduce(
      (sum, s) => sum + (parseFloat(s.kg) || 0) * (parseInt(s.reps, 10) || 0), 0,
    );

    const prevVolAtSamePoint = ex.prevSets
      .slice(0, completedCount)
      .reduce((sum, s) => sum + s.kg * s.reps, 0);
    const behind = completedCount > 0 && currentVol < prevVolAtSamePoint;

    const beaten = currentVol > prevTotal;
    const barMax = prevTotal * 1.2;
    const fillPct = Math.min(currentVol / barMax, 1);
    const ghostPct = 1 / 1.2;

    let suggestion: string | null = null;
    let altSuggestion: string | null = null;
    // Show suggestion after at least one set is done and not yet beaten
    if (!beaten && completedCount > 0) {
      const remaining = prevTotal - currentVol + 1;
      if (remaining > 0) {
        // Always base on what the user just did — last completed set
        const lastSet = completedSets[completedCount - 1];
        const lastKg = parseFloat(lastSet.kg) || 0;
        const lastReps = parseInt(lastSet.reps, 10) || 0;

        if (lastKg > 0 && lastReps > 0) {
          const MIN_REPS = 5;
          // Estimate 1RM using Epley: e1RM = weight × (1 + reps/30)
          const e1rm = lastKg * (1 + lastReps / 30);

          // If last reps + 1 >= MIN_REPS, suggest same weight
          // Otherwise, scale weight down to something doable for MIN_REPS
          let suggestKg: number;
          let maxReps: number;
          if (lastReps + 1 >= MIN_REPS) {
            suggestKg = lastKg;
            maxReps = lastReps + 1;
          } else {
            // Weight they could realistically do for MIN_REPS
            suggestKg = Math.round((e1rm / (1 + MIN_REPS / 30)) / 2.5) * 2.5;
            maxReps = MIN_REPS + 1;
          }

          if (suggestKg > 0) {
            const repsToClose = Math.max(Math.ceil(remaining / suggestKg), MIN_REPS);
            const repsNeeded = Math.min(repsToClose, maxReps);
            suggestion = `${suggestKg}kg × ${repsNeeded}`;

            // Lighter option: 80% weight — only show if it results in MORE reps
            const lightKg = Math.round(suggestKg * 0.8 / 2.5) * 2.5;
            if (lightKg > 0 && lightKg < suggestKg) {
              const lightMaxReps = Math.round(30 * (e1rm / lightKg - 1));
              const lightRepsToClose = Math.max(Math.ceil(remaining / lightKg), MIN_REPS);
              const lightReps = Math.min(lightRepsToClose, Math.max(lightMaxReps, MIN_REPS));
              if (lightReps > repsNeeded) {
                altSuggestion = `${lightKg}kg × ${lightReps}`;
              }
            }
          }
        }
      }
    }

    const onTrack = completedCount > 0 && !behind && !beaten;
    const incompleteSets = ex.sets.filter((s) => !s.completed).length;
    const needsMoreSets = completedCount > 0 && !beaten && incompleteSets === 0;

    const remaining = Math.max(prevTotal - currentVol + 1, 0);

    // Per-set ghost scoring — compare by original set position
    let setWins = 0;
    let setLosses = 0;
    let setTies = 0;
    let lastSetResult: 'win' | 'loss' | 'tie' | null = null;
    for (let i = 0; i < Math.min(ex.sets.length, ex.prevSets.length); i++) {
      const s = ex.sets[i];
      if (!s.completed) continue;
      const uKg = parseFloat(s.kg) || 0;
      const uReps = parseInt(s.reps, 10) || 0;
      const r = compareGhostSet(uKg, uReps, ex.prevSets[i].kg, ex.prevSets[i].reps);
      if (r === 'win') setWins++;
      else if (r === 'loss') setLosses++;
      else setTies++;
      lastSetResult = r;
    }

    return { prevTotal, currentVol, remaining, segments, fillPct, ghostPct, beaten, behind, onTrack, needsMoreSets, suggestion, altSuggestion, completedCount, setWins, setLosses, setTies, lastSetResult };
  }, [exercises]);

  if (exercises.length === 0) return null;

  const ex = exercises[0];

  // Ghost mode: simple set-by-set list
  if (isGhost) {
    const prevSets = ex?.prevSets ?? [];
    if (prevSets.length === 0) return null;

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
              const userSet = ex.sets[i];
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
  }

  // Non-ghost: progressive overload
  const currentColor = overload?.beaten ? '#34C759' : overload?.behind ? colors.accentRed : colors.textPrimary;

  return (
    <View style={{ marginTop: sw(10) }}>
      {overload ? (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: sw(8),
          padding: sw(10),
          gap: sw(8),
        }}>
          {/* Label */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{
              fontSize: ms(9),
              fontFamily: Fonts.semiBold,
              color: colors.textTertiary,
              textTransform: 'uppercase',
              letterSpacing: 0.8,
            }}>
              Target To Beat
            </Text>
            <Text style={{
              fontSize: ms(10),
              fontFamily: Fonts.medium,
              color: colors.textTertiary,
            }}>
              <Text style={{ color: currentColor, fontFamily: Fonts.bold }}>
                {Math.round(overload.currentVol).toLocaleString()}
              </Text>
              {' / '}{Math.round(overload.prevTotal).toLocaleString()} kg
            </Text>
          </View>

          {/* Segmented ghost bar */}
          <View style={{
            height: sw(5),
            borderRadius: sw(2.5),
            backgroundColor: colors.cardBorder,
            flexDirection: 'row',
            overflow: 'hidden',
          }}>
            {overload.segments.map((_, i) => (
              <View
                key={i}
                style={{
                  flex: (overload.segments[i] - (overload.segments[i - 1] ?? 0)) * overload.ghostPct,
                  borderRightWidth: i < overload.segments.length - 1 ? sw(1.5) : 0,
                  borderRightColor: colors.surface,
                }}
              />
            ))}
            <View style={{ flex: 1 - overload.ghostPct }} />
            <View style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              borderRadius: sw(2.5),
              width: `${Math.min(overload.fillPct, overload.ghostPct) * 100}%`,
              backgroundColor: colors.accent,
            }} />
            {overload.beaten && (
              <View style={{
                position: 'absolute',
                left: `${overload.ghostPct * 100}%`,
                top: 0,
                bottom: 0,
                borderTopRightRadius: sw(2.5),
                borderBottomRightRadius: sw(2.5),
                width: `${(overload.fillPct - overload.ghostPct) * 100}%`,
                backgroundColor: '#34C759',
              }} />
            )}
            <View style={{
              position: 'absolute',
              left: `${overload.ghostPct * 100}%`,
              top: 0,
              bottom: 0,
              width: sw(2),
              backgroundColor: overload.beaten ? colors.accent : colors.textTertiary,
              marginLeft: -sw(1),
            }} />
          </View>

          {/* Set markers — kg × reps targets */}
          <View style={{ flexDirection: 'row', marginTop: sw(2) }}>
            {overload.segments.map((_, i) => {
              const prev = exercises[0]?.prevSets[i];
              return (
                <Text
                  key={i}
                  style={{
                    flex: (overload.segments[i] - (overload.segments[i - 1] ?? 0)) * overload.ghostPct,
                    textAlign: 'center',
                    color: colors.textTertiary,
                    fontSize: ms(8),
                    fontFamily: Fonts.medium,
                  }}
                  numberOfLines={1}
                >
                  {prev ? `${prev.kg}×${prev.reps}` : `S${i + 1}`}
                </Text>
              );
            })}
            <View style={{ flex: 1 - overload.ghostPct }} />
          </View>

          {/* Needs more sets */}
          {overload.needsMoreSets && (
            <Text style={{
              color: colors.accent,
              fontSize: ms(10),
              fontFamily: Fonts.semiBold,
            }}>
              {`${overload.remaining.toLocaleString()}kg left — add a set`}
            </Text>
          )}

          {/* Suggestion — behind with incomplete sets */}
          {overload.suggestion && !overload.beaten && !overload.needsMoreSets && overload.behind && (
            <Text style={{
              color: colors.textSecondary,
              fontSize: ms(10),
              fontFamily: Fonts.medium,
            }}>
              Suggestion: Try <Text style={{ color: colors.accent, fontFamily: Fonts.bold }}>{overload.suggestion}</Text>
              {overload.altSuggestion && (
                <Text> or <Text style={{ color: colors.accent, fontFamily: Fonts.bold }}>{overload.altSuggestion}</Text></Text>
              )}
            </Text>
          )}

          {/* Beaten / on track */}
          {overload.beaten && (
            <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: '#34C759' }}>
              Progressive overload achieved
            </Text>
          )}
          {overload.onTrack && !overload.needsMoreSets && (
            <Text style={{ fontSize: ms(10), fontFamily: Fonts.semiBold, color: colors.accent }}>
              On track to beat last session
            </Text>
          )}
        </View>
      ) : (
        <View style={{
          backgroundColor: colors.surface,
          borderRadius: sw(8),
          padding: sw(10),
          flexDirection: 'row',
          alignItems: 'center',
          gap: sw(6),
        }}>
          <Ionicons name="flash-outline" size={ms(12)} color={colors.textTertiary} />
          <Text style={{
            fontSize: ms(11),
            fontFamily: Fonts.medium,
            color: colors.textTertiary,
            flex: 1,
          }}>
            First session — set your benchmark
          </Text>
        </View>
      )}
    </View>
  );
});

/* ═══════════════════════════════════════════════════════════
   ActiveWorkoutSheet
   ─────────────────────────────────────────────────────────
   Renders when a workout is active. The sheet stays in the
   tree the entire time — open/close is purely a translateY
   animation, no mount/unmount, no Modal overhead.

   Architecture notes for FPS:
   - RestTimerBar is self-contained (reads from store, not props)
     so SheetOverlay never re-renders from rest-timer ticks.
   - WorkoutHeader is React.memo'd — timer tick re-renders
     only WorkoutHeader, not the whole sheet.
   - GPU rasterization hints on the animated sheet view
     pre-render to hardware texture during animation.
   ═══════════════════════════════════════════════════════════ */

export default function ActiveWorkoutSheet() {
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const sheetVisible = useActiveWorkoutStore((s) => s.sheetVisible);
  const showSummary = useActiveWorkoutStore((s) => s.showSummary);
  const summaryData = useActiveWorkoutStore((s) => s.summaryData);
  const dismissSummary = useActiveWorkoutStore((s) => s.dismissSummary);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerMode, setPickerMode] = useState<'add' | 'replace'>('add');
  const [replaceIndex, setReplaceIndex] = useState(-1);

  const prevMap = useWorkoutStore((s) => s.prevMap);
  const addExercise = useActiveWorkoutStore((s) => s.addExercise);
  const replaceExercise = useActiveWorkoutStore((s) => s.replaceExercise);

  const handleOpenReplace = useCallback((idx: number) => {
    setPickerMode('replace');
    setReplaceIndex(idx);
    setPickerVisible(true);
  }, []);

  const handleOpenAdd = useCallback(() => {
    setPickerMode('add');
    setPickerVisible(true);
  }, []);

  const handlePickerSelect = useCallback(
    (name: string, exerciseType: string, category: string | null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevSets = prevMap[name] || [];
      if (pickerMode === 'replace' && replaceIndex >= 0) {
        replaceExercise(replaceIndex, name, exerciseType, category, prevSets);
      } else {
        addExercise(name, exerciseType, category, prevSets);
      }
    },
    [prevMap, pickerMode, replaceIndex, addExercise, replaceExercise],
  );

  /* Guard — nothing to render if no active workout & no summary */
  if (!isActive && !showSummary) return null;

  return (
    <Modal visible={sheetVisible} transparent statusBarTranslucent animationType="none">
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        <SheetOverlay
          onOpenAdd={handleOpenAdd}
          onOpenReplace={handleOpenReplace}
        />

        <ExercisePicker
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelect={handlePickerSelect}
          mode={pickerMode}
        />
      </GestureHandlerRootView>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════════
   SheetOverlay — isolated animation + content
   ─────────────────────────────────────────────────────────
   Separated so that picker/summary state changes in the
   parent don't trigger re-animation of the sheet itself.

   KEY OPTIMIZATION: This component does NOT subscribe to
   isResting / restRemaining / restDuration. RestTimerBar
   is self-contained and reads those from the store directly.
   This means rest-timer ticks (every 1s) NEVER cause
   SheetOverlay to re-render.
   ═══════════════════════════════════════════════════════════ */

interface OverlayProps {
  onOpenAdd: () => void;
  onOpenReplace: (idx: number) => void;
}

const SheetOverlay = React.memo(function SheetOverlay({
  onOpenAdd,
  onOpenReplace,
}: OverlayProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  /* ─── Store slices (minimal — no rest-timer state) ──── */

  const sheetVisible = useActiveWorkoutStore((s) => s.sheetVisible);
  const hideSheet = useActiveWorkoutStore((s) => s.hideSheet);
  const exercises = useActiveWorkoutStore((s) => s.exercises);

  /* ─── Focused exercise tracking ────────────────────── */

  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Auto-default: first exercise with incomplete sets
  const defaultIndex = useMemo(
    () => {
      const idx = exercises.findIndex((ex) => ex.sets.some((s) => !s.completed));
      return idx >= 0 ? idx : exercises.length - 1;
    },
    [exercises],
  );

  const activeIndex = focusedIndex >= 0 && focusedIndex < exercises.length ? focusedIndex : defaultIndex;
  const currentExercise = exercises[activeIndex] ?? null;

  const exerciseYRef = useRef<Record<number, number>>({});

  const handleExerciseFocus = useCallback((idx: number) => {
    setFocusedIndex(idx);
  }, []);

  /* ─── Refs ──────────────────────────────────────────── */

  const hideSheetRef = useRef(hideSheet);
  hideSheetRef.current = hideSheet;
  const openRef = useRef(false);
  const gestureClosingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll selected exercise to top when user taps a different card
  useEffect(() => {
    if (focusedIndex < 0) return;
    const y = exerciseYRef.current[focusedIndex];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - sw(8)), animated: true });
    }
  }, [focusedIndex]);
  const scrollOffsetRef = useRef(0);
  const inputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ─── Animation (UI thread) ─────────────────────────── */

  const translateY = useSharedValue(SHEET_H);
  const ctx = useSharedValue(0);

  useEffect(() => {
    if (sheetVisible) {
      openRef.current = true;
      gestureClosingRef.current = false;
      cancelAnimation(translateY);
      translateY.value = 0; // instant open, no animation
    } else if (openRef.current) {
      openRef.current = false;
      if (!gestureClosingRef.current) {
        cancelAnimation(translateY);
        translateY.value = withTiming(SHEET_H, CLOSE_CFG);
      }
      gestureClosingRef.current = false;
    }
  }, [sheetVisible]);

  useEffect(() => () => cancelAnimation(translateY), []);

  /* Backdrop: instant on open, follows drag on close */
  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = 1 - translateY.value / SHEET_H;
    // Clamp higher so backdrop is fully opaque even when sheet is still animating in
    return { opacity: progress > 0.05 ? BACKDROP_MAX : 0 };
  });

  /* Sheet: transform derived from translateY on UI thread */
  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateY: Math.max(0, translateY.value) }] };
  });

  /* ─── Gesture (UI thread) ───────────────────────────── */

  const handleDismiss = useCallback(() => {
    gestureClosingRef.current = true;
    hideSheetRef.current();
  }, []);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => {
          ctx.value = translateY.value;
        })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (
            e.translationY > DISMISS_THRESHOLD ||
            e.velocityY > VELOCITY_THRESHOLD
          ) {
            translateY.value = withSpring(SHEET_H, {
              velocity: e.velocityY,
              damping: 50,
              stiffness: 300,
              mass: 0.8,
              overshootClamping: true,
            });
            runOnJS(handleDismiss)();
          } else {
            translateY.value = withSpring(0, SNAP_SPRING);
          }
        }),
    [handleDismiss],
  );

  /* ─── Keyboard ──────────────────────────────────────── */

  const [iosKb, setIosKb] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const s = Keyboard.addListener('keyboardWillShow', (e) =>
      setIosKb(e.endCoordinates.height),
    );
    const h = Keyboard.addListener('keyboardWillHide', () => setIosKb(0));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  const { height: winH } = useWindowDimensions();
  const maxWinH = useRef(winH);
  if (winH > maxWinH.current) maxWinH.current = winH;
  const androidKb =
    Platform.OS === 'android' ? Math.max(0, maxWinH.current - winH) : 0;

  const kbHeight = Platform.OS === 'ios' ? iosKb : androidKb;
  const kbOpen = Platform.OS === 'ios' ? iosKb > 0 : androidKb > 100;

  /* Auto-scroll to focused input */
  useEffect(() => () => {
    if (inputTimerRef.current) clearTimeout(inputTimerRef.current);
  }, []);

  const handleScroll = useCallback((e: any) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  const handleInputFocus = useCallback(
    (pageY: number) => {
      if (inputTimerRef.current) clearTimeout(inputTimerRef.current);
      const delay = Platform.OS === 'android' ? 300 : 100;
      inputTimerRef.current = setTimeout(() => {
        const screenH = Dimensions.get('window').height;
        const visibleBottom =
          Platform.OS === 'ios' ? screenH - (kbHeight || 300) : screenH;
        const inputBottom = pageY + 50;
        if (inputBottom > visibleBottom - 40) {
          scrollRef.current?.scrollTo({
            y: scrollOffsetRef.current + (inputBottom - visibleBottom + 40),
            animated: true,
          });
        }
      }, delay);
    },
    [kbHeight],
  );

  /* ─── Render ────────────────────────────────────────── */

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents={sheetVisible ? 'auto' : 'none'}
    >
      {/* Backdrop */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => hideSheetRef.current()}
      >
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </Pressable>

      {/* Sheet — GPU rasterization during animation */}
      <Animated.View
        style={[styles.sheet, sheetStyle]}
        renderToHardwareTextureAndroid
      >
        {/* Drag handle — swipe down to dismiss */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.handleRow, { paddingTop: sw(12) }]}>
            <View style={styles.handle} />
          </Animated.View>
        </GestureDetector>

        <WorkoutHeader />

        {/* Self-contained: reads from store, never causes SheetOverlay re-render */}
        <RestTimerBar />

        {/* Ghost mode: exercise win/loss tally */}
        <GhostTally exercises={exercises} />

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            kbOpen && { paddingBottom: kbHeight },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={Platform.OS === 'android'}
        >
          {exercises.map((ex, i) => (
            <View
              key={`${ex.name}-${i}`}
              onLayout={(e) => { exerciseYRef.current[i] = e.nativeEvent.layout.y; }}
            >
              <ExerciseCard
                exercise={ex}
                exerciseIndex={i}
                isLast={i === exercises.length - 1}
                totalExercises={exercises.length}
                isCurrent={i === activeIndex}
                overloadTracker={i === activeIndex ? <ProgressiveOverloadCard exercises={[ex]} /> : undefined}
                onReplace={onOpenReplace}
                onExerciseFocus={handleExerciseFocus}
                onInputFocus={handleInputFocus}
              />
              {ex.supersetWith === i + 1 && (
                <View style={styles.supersetConnector}>
                  <View style={styles.connectorLine} />
                  <Text style={styles.supersetLabel}>SUPERSET</Text>
                  <View style={styles.connectorLine} />
                </View>
              )}
            </View>
          ))}

          {exercises.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons
                name="barbell-outline"
                size={ms(36)}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>
                Add an exercise to get started
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Add Exercise button — hidden when keyboard is open */}
        {!kbOpen && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + sw(10) }]}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={onOpenAdd}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={ms(28)} color={colors.textOnAccent} />
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </View>
  );
});

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#000000',
    },
    sheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: SHEET_H,
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS,
      borderTopRightRadius: RADIUS,
      overflow: 'hidden',
    },
    handleRow: {
      alignItems: 'center',
      paddingVertical: sw(18),
    },
    handle: {
      width: HANDLE_W,
      height: sw(5),
      borderRadius: sw(3),
      backgroundColor: colors.textTertiary,
    },
    scroll: {
      flex: 1,
    },
    content: {
      padding: sw(16),
      paddingBottom: sw(20),
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: sw(40),
      gap: sw(12),
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
    },
    footer: {
      alignItems: 'center',
      paddingVertical: sw(10),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    addBtn: {
      width: sw(52),
      height: sw(52),
      borderRadius: sw(26),
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    supersetConnector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      marginVertical: sw(-2),
    },
    connectorLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.accent,
    },
    supersetLabel: {
      color: colors.accent,
      fontSize: ms(10),
      fontFamily: Fonts.bold,
      lineHeight: ms(14),
      paddingHorizontal: sw(8),
      letterSpacing: 1,
    },
  });
