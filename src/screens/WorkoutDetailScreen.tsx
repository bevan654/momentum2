import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { showRecoveryOverlay } from '../lib/navigationBridge';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'WorkoutDetail'>;

const SCREEN_H = Dimensions.get('window').height;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h > 0) return `${h}h ${rm}m`;
  return `${m}m`;
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k kg`;
  return `${vol} kg`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

export default function WorkoutDetailScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const { workoutId } = route.params;

  const workout = useWorkoutStore((s) => s.workouts.find((w) => w.id === workoutId));
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, insets.top), [colors, insets.top]);

  const translateY = useSharedValue(0);
  const ctx = useSharedValue(0);

  const dismiss = useCallback(() => {
    showRecoveryOverlay();
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => { ctx.value = translateY.value; })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > 120 || e.velocityY > 800) {
            translateY.value = SCREEN_H;
            runOnJS(dismiss)();
          } else {
            translateY.value = 0;
          }
        }),
    [dismiss],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: Math.max(0, translateY.value) }],
  }));

  if (!workout) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Workout not found</Text>
        </View>
      </View>
    );
  }

  const totalSets = workout.exercises.reduce((n, ex) => n + ex.sets.length, 0);

  return (
    <Animated.View style={[styles.container, sheetStyle]}>
      {/* Drag handle */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={styles.handleRow} hitSlop={{ top: 10, bottom: 10 }}>
          <View style={styles.handle} />
        </Animated.View>
      </GestureDetector>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerSpacer} />
          <Text style={styles.headerTitle}>Workout Summary</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Workout info */}
        <View style={styles.routineInfo}>
          <Text style={styles.routineName}>{workout.programName || 'Workout'}</Text>
          <Text style={styles.routineSub}>
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
            {'  ·  '}{formatDate(workout.created_at)}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDuration(workout.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatVolume(workout.totalVolume)}</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalSets}</Text>
            <Text style={styles.statLabel}>Sets</Text>
          </View>
        </View>

        {/* Exercise cards */}
        {workout.exercises.map((ex, i) => {
          const minR = ex.sets.length > 0 ? Math.min(...ex.sets.map((s) => s.reps)) : 0;
          const maxR = ex.sets.length > 0 ? Math.max(...ex.sets.map((s) => s.reps)) : 0;
          const repRange = minR === maxR ? `${minR}` : `${minR}-${maxR}`;

          return (
            <View key={i} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderLeft}>
                  <Text style={styles.exerciseName} numberOfLines={1}>
                    {ex.name.replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </Text>
                  <Text style={styles.exerciseSummary}>
                    {ex.sets.length} sets · {repRange} reps
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Column headers */}
              <View style={styles.colHeaders}>
                <Text style={[styles.colHeader, styles.colSet]}>SET</Text>
                <Text style={[styles.colHeader, styles.colVal]}>KG</Text>
                <Text style={[styles.colHeader, styles.colVal]}>REPS</Text>
              </View>

              {/* Set rows */}
              {ex.sets.map((s, si) => (
                <View key={si} style={styles.setRow}>
                  <Text style={[styles.setNum, styles.colSet]}>{si + 1}</Text>
                  <Text style={[styles.cellVal, styles.colVal]}>
                    {s.kg ? s.kg : '—'}
                  </Text>
                  <Text style={[styles.cellVal, styles.colVal]}>{s.reps || '—'}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.deleteBtn}
          activeOpacity={0.7}
          onPress={() => {
            Alert.alert('Delete Workout', 'Are you sure you want to delete this workout?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  dismiss();
                  await deleteWorkout(workout.id);
                },
              },
            ]);
          }}
        >
          <Ionicons name="trash-outline" size={ms(20)} color={colors.accentRed} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const createStyles = (colors: ThemeColors, topInset: number) => StyleSheet.create({
  container: {
    flex: 1,
    marginTop: topInset + sw(110),
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(16),
    borderTopRightRadius: sw(16),
    overflow: 'hidden',
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: sw(10),
  },
  handle: {
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.textTertiary + '60',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(80),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sw(12),
  },
  headerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  headerSpacer: {
    width: sw(36),
    height: sw(36),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
  },
  routineInfo: {
    marginBottom: sw(16),
    gap: sw(4),
  },
  routineName: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
  },
  routineSub: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(8),
    marginBottom: sw(16),
    backgroundColor: colors.card,
    borderWidth: sw(1),
    borderColor: colors.cardBorder,
    borderRadius: sw(8),
    paddingHorizontal: sw(8),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(2),
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: sw(24),
    backgroundColor: colors.cardBorder,
  },
  exerciseCard: {
    backgroundColor: colors.card,
    borderWidth: sw(2),
    borderColor: colors.cardBorder,
    padding: sw(12),
    marginBottom: sw(10),
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  exerciseHeaderLeft: {
    flex: 1,
    gap: sw(4),
    marginRight: sw(10),
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  exerciseSummary: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginVertical: sw(10),
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(2),
  },
  colHeader: {
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
  colVal: {
    flex: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  setNum: {
    color: colors.textSecondary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  cellVal: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: sw(32),
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  deleteBtn: {
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
