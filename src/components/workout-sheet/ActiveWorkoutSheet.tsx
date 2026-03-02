import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  Text,
  Pressable,
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
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import WorkoutHeader from './WorkoutHeader';
import RestTimerBar from './RestTimerBar';
import ExerciseCard from './ExerciseCard';
import ExercisePicker from './ExercisePicker';
import WorkoutSummaryModal from './WorkoutSummaryModal';

/* ─── Constants (computed once) ────────────────────────── */

const SCREEN_H = Dimensions.get('window').height;
const SHEET_H = Math.round(SCREEN_H * 0.9);
const RADIUS = sw(20);
const HANDLE_W = sw(40);
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;
const BACKDROP_MAX = 0.5;

const OPEN_SPRING = { damping: 28, stiffness: 280, mass: 0.8 };
const SNAP_SPRING = { damping: 24, stiffness: 350, mass: 0.7 };
const CLOSE_CFG = { duration: 250, easing: Easing.in(Easing.cubic) };

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
    <>
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

      {showSummary && summaryData && (
        <WorkoutSummaryModal
          mode="just-completed"
          data={summaryData}
          onDismiss={dismissSummary}
        />
      )}
    </>
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
  const styles = useMemo(() => createStyles(colors), [colors]);

  /* ─── Store slices (minimal — no rest-timer state) ──── */

  const sheetVisible = useActiveWorkoutStore((s) => s.sheetVisible);
  const hideSheet = useActiveWorkoutStore((s) => s.hideSheet);
  const exercises = useActiveWorkoutStore((s) => s.exercises);

  /* ─── Refs ──────────────────────────────────────────── */

  const hideSheetRef = useRef(hideSheet);
  hideSheetRef.current = hideSheet;
  const openRef = useRef(false);
  const gestureClosingRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
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
      translateY.value = SHEET_H;
      translateY.value = withSpring(0, OPEN_SPRING);
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

  /* Backdrop: opacity derived from translateY on UI thread */
  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = 1 - translateY.value / SHEET_H;
    return { opacity: Math.max(0, Math.min(BACKDROP_MAX, progress * BACKDROP_MAX)) };
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
        {/* Drag handle — large touch target for reliable iOS gestures */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.handleRow} hitSlop={{ top: 10, bottom: 10 }}>
            <View style={styles.handle} />
          </Animated.View>
        </GestureDetector>

        <WorkoutHeader />

        {/* Self-contained: reads from store, never causes SheetOverlay re-render */}
        <RestTimerBar />

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
            <React.Fragment key={`${ex.name}-${i}`}>
              <ExerciseCard
                exercise={ex}
                exerciseIndex={i}
                isLast={i === exercises.length - 1}
                totalExercises={exercises.length}
                onReplace={onOpenReplace}
                onInputFocus={handleInputFocus}
              />
              {ex.supersetWith === i + 1 && (
                <View style={styles.supersetConnector}>
                  <View style={styles.connectorLine} />
                  <Text style={styles.supersetLabel}>SUPERSET</Text>
                  <View style={styles.connectorLine} />
                </View>
              )}
            </React.Fragment>
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
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.addBtn}
              onPress={onOpenAdd}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add"
                size={ms(20)}
                color={colors.textOnAccent}
              />
              <Text style={styles.addBtnText}>Add Exercise</Text>
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
      backgroundColor: colors.cardBorder,
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
      paddingHorizontal: sw(16),
      paddingVertical: sw(12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      paddingVertical: sw(14),
      gap: sw(6),
    },
    addBtnText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
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
