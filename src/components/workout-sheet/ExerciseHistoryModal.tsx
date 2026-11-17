import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Overlay from '../ui/Overlay';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  cancelAnimation,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { titleCase } from '../../utils/titleCase';
import { createHistoryStyles } from './exercise-history/historyStyles';
import { useExerciseHistory, type HistoryEntry } from './exercise-history/useExerciseHistory';
import HistoryChart from './exercise-history/HistoryChart';
import HistoryTable, { daysAgo } from './exercise-history/HistoryTable';
import PrCards from './exercise-history/PrCards';

/* ─── Constants ─────────────────────────────────────────── */

const SCREEN_W = Dimensions.get('window').width;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 800;
const BACKDROP_MAX = 0.6;

interface Props {
  exerciseName: string | null;
  visible: boolean;
  onClose: () => void;
}

const keyExtractor = (entry: HistoryEntry, idx: number) => entry.workoutId + idx;

/* ─── Component ─────────────────────────────────────────── */

function ExerciseHistoryModal({ exerciseName, visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createHistoryStyles(colors), [colors]);

  const [alive, setAlive] = useState(false);
  const openRef = useRef(false);
  const closingRef = useRef(false);

  const {
    loading, history, chartMode, setChartMode, reset,
    prs, avgWeight, lastEntry, suggestedNext, isBodyweight, chartPoints, yScale,
  } = useExerciseHistory(exerciseName, visible);

  /* ─── Animation ──────────────────────────────────────── */

  const translateX = useSharedValue(SCREEN_W);
  const ctx = useSharedValue(0);

  const cleanup = useCallback(() => {
    setAlive(false);
    reset();
  }, [reset]);

  const handleDismiss = useCallback(() => {
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setAlive(true);
      openRef.current = true;
      closingRef.current = false;
      cancelAnimation(translateX);
      translateX.value = 0;
    } else if (openRef.current) {
      openRef.current = false;
      cancelAnimation(translateX);
      translateX.value = SCREEN_W;
      cleanup();
      closingRef.current = false;
    }
  }, [visible]);

  useEffect(() => () => cancelAnimation(translateX), []);

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    const progress = 1 - translateX.value / SCREEN_W;
    return { opacity: Math.max(0, progress * BACKDROP_MAX) };
  });

  const sheetStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ translateX: Math.max(0, translateX.value) }] };
  });

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX(10)
        .failOffsetY([-15, 15])
        .onStart(() => { ctx.value = translateX.value; })
        .onUpdate((e) => { translateX.value = Math.max(0, ctx.value + e.translationX); })
        .onEnd((e) => {
          if (e.translationX > DISMISS_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD) {
            translateX.value = SCREEN_W;
            runOnJS(handleDismiss)();
          } else {
            translateX.value = 0;
          }
        }),
    [handleDismiss],
  );

  // Sessions are list items (up to 100, each with all its sets), so only the visible ones render.
  const renderSession = useCallback(
    ({ item }: { item: HistoryEntry }) => (
      <View style={styles.historyItem}>
        <HistoryTable styles={styles} entry={item} />
      </View>
    ),
    [styles],
  );

  /* ─── Render guard ───────────────────────────────────── */

  if (!alive) return null;

  const listHeader = history.length === 0 ? null : (
    <View style={styles.listHeader}>
      {/* ─── Summary ─── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>SUMMARY</Text>
        {/* Stats grid */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryCellValue}>{history.length}</Text>
            <Text style={styles.summaryCellLabel}>Sessions</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryCellValue}>{avgWeight > 0 ? `${avgWeight}` : '—'}</Text>
            <Text style={styles.summaryCellLabel}>Avg kg</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryCellValue}>{daysAgo(lastEntry!.date)}</Text>
            <Text style={styles.summaryCellLabel}>Last Done</Text>
          </View>
        </View>
        {/* Suggested next */}
        {suggestedNext && suggestedNext.kg > 0 && (
          <View style={styles.suggestedCard}>
            <Ionicons name="trending-up" size={ms(14)} color={colors.accentGreen} />
            <Text style={styles.suggestedLabel}>Next target</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.suggestedValue}>
              {suggestedNext.kg}kg × {suggestedNext.reps}
            </Text>
          </View>
        )}
      </View>

      {/* ─── Personal Records ─── */}
      <PrCards styles={styles} prs={prs} />

      {/* ─── Progress Chart ─── */}
      {chartPoints.length >= 2 && (
        <HistoryChart
          styles={styles}
          chartPoints={chartPoints}
          yScale={yScale}
          chartMode={chartMode}
          setChartMode={setChartMode}
          isBodyweight={isBodyweight}
        />
      )}

      {/* ─── History Table (sessions follow as list items) ─── */}
      <Text style={styles.sectionLabel}>HISTORY</Text>
    </View>
  );

  return (
    <Overlay visible animationType="none">
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
        {/* Backdrop */}
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDismiss}>
          <Animated.View style={[styles.backdrop, backdropStyle]} />
        </Pressable>

        {/* Sheet */}
        <Animated.View style={[styles.sheet, sheetStyle, { paddingTop: insets.top }]}>
          {/* Header with pan gesture */}
          <GestureDetector gesture={panGesture}>
            <Animated.View style={styles.header}>
              <TouchableOpacity onPress={handleDismiss} style={styles.backBtn} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {exerciseName ? titleCase(exerciseName) : ''}
              </Text>
              <View style={{ width: sw(32) }} />
            </Animated.View>
          </GestureDetector>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="time-outline" size={ms(40)} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>No History</Text>
              <Text style={styles.emptySub}>Complete a workout with this exercise to see your history here</Text>
            </View>
          ) : (
            <FlashList
              data={history}
              keyExtractor={keyExtractor}
              renderItem={renderSession}
              ListHeaderComponent={listHeader}
              style={styles.scroll}
              contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + sw(20) }]}
              showsVerticalScrollIndicator={false}
            />
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Overlay>
  );
}

export default React.memo(ExerciseHistoryModal);
