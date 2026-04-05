import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore, type WorkoutWithDetails } from '../../stores/useWorkoutStore';
import ShareModal from './ShareModal';
import WorkoutOverlay, { type WorkoutOverlayData, type CardVariant } from '../dev/WorkoutOverlay';
import MonthlyOverlay, { type MonthlyOverlayData } from '../dev/MonthlyOverlay';

const VARIANTS: { key: CardVariant; label: string }[] = [
  { key: 'classic', label: 'Classic' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'bold', label: 'Bold' },
  { key: 'poster', label: 'Poster' },
];

/* ─── Helpers ───────────────────────────────────────────── */

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toDateKeyFromISO(iso: string): string {
  const d = new Date(iso);
  return toDateKey(d);
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function formatWorkoutDate(iso: string): string {
  const d = new Date(iso);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ─── Types ─────────────────────────────────────────────── */

type ShareMode = 'workout' | 'overview';

interface Props {
  visible: boolean;
  onClose: () => void;
  initialWorkout?: WorkoutWithDetails | null;
}

/* ─── Component ─────────────────────────────────────────── */

export default function ShareHub({ visible, onClose, initialWorkout }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const workouts = useWorkoutStore((s) => s.workouts);

  const [mode, setMode] = useState<ShareMode>(initialWorkout ? 'workout' : 'overview');
  const [variant, setVariant] = useState<CardVariant>('classic');
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(initialWorkout ?? null);
  const [showPicker, setShowPicker] = useState(false);

  // Date range for overview
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 55);
    return toDateKey(d);
  });
  const [endDate, setEndDate] = useState(() => toDateKey(new Date()));

  const shiftDate = useCallback((which: 'start' | 'end', days: number) => {
    const shift = (prev: string) => {
      const d = new Date(prev + 'T12:00:00');
      d.setDate(d.getDate() + days);
      return toDateKey(d);
    };
    if (which === 'start') setStartDate(shift);
    else setEndDate(shift);
  }, []);

  // Monthly data
  const monthlyData = useMemo((): MonthlyOverlayData => {
    const trainedDates = [...new Set(workouts.map((w) => toDateKeyFromISO(w.created_at)))];
    return {
      trainedDates,
      workouts: workouts.map((w) => ({
        created_at: w.created_at,
        totalVolume: w.totalVolume,
        exercises: w.exercises,
      })),
    };
  }, [workouts]);

  // Workout overlay data
  const workoutData = useMemo((): WorkoutOverlayData | null => {
    if (!selectedWorkout) return null;
    return {
      exercises: selectedWorkout.exercises.map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type || 'weighted',
        sets: ex.sets.map((s) => ({
          kg: s.kg,
          reps: s.reps,
          completed: s.completed,
          set_type: s.set_type || 'working',
        })),
      })),
      duration: selectedWorkout.duration,
      date: new Date(selectedWorkout.created_at),
      workoutName: null,
    };
  }, [selectedWorkout]);

  const handleClose = useCallback(() => {
    setShowPicker(false);
    onClose();
  }, [onClose]);

  /* ─── Controls above the card ─────────────────────────── */

  const controls = useMemo(() => (
    <View style={styles.controlsWrap}>
      {/* Mode tabs */}
      <View style={styles.modeTabs}>
        {(['workout', 'overview'] as const).map((tab) => {
          const label = tab === 'workout' ? 'Workout' : 'Overview';
          const icon = tab === 'workout' ? 'barbell-outline' : 'calendar-outline';
          const isActive = mode === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.modeTab, isActive && styles.modeTabActive]}
              onPress={() => { setMode(tab); setShowPicker(false); }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={icon as any}
                size={ms(14)}
                color={isActive ? colors.textOnAccent : colors.textTertiary}
              />
              <Text style={[styles.modeTabText, isActive && styles.modeTabTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Variant picker (workout mode only) */}
      {mode === 'workout' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.variantRow}
          style={styles.variantScroll}
        >
          {VARIANTS.map((v) => {
            const active = variant === v.key;
            return (
              <TouchableOpacity
                key={v.key}
                style={[styles.variantChip, active && styles.variantChipActive]}
                onPress={() => setVariant(v.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.variantChipText, active && styles.variantChipTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Mode-specific controls */}
      {mode === 'workout' && (
        <View style={styles.workoutPickerWrap}>
          <TouchableOpacity
            style={styles.workoutPickerBtn}
            onPress={() => setShowPicker(!showPicker)}
            activeOpacity={0.7}
          >
            <View style={[styles.workoutPickerIcon, { backgroundColor: colors.accent + '18' }]}>
              <Ionicons name="barbell" size={ms(14)} color={colors.accent} />
            </View>
            <Text style={styles.workoutPickerText} numberOfLines={1}>
              {selectedWorkout
                ? `${formatWorkoutDate(selectedWorkout.created_at)} — ${formatDuration(selectedWorkout.duration)}`
                : 'Select a workout'}
            </Text>
            <Ionicons name={showPicker ? 'chevron-up' : 'chevron-down'} size={ms(16)} color={colors.textTertiary} />
          </TouchableOpacity>

          {showPicker && (
            <ScrollView style={styles.workoutList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {workouts.slice(0, 20).map((w) => {
                const isSelected = selectedWorkout?.id === w.id;
                const muscles = w.muscleGroups.join(', ');
                return (
                  <TouchableOpacity
                    key={w.id}
                    style={[styles.workoutItem, isSelected && styles.workoutItemActive]}
                    onPress={() => { setSelectedWorkout(w); setShowPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.workoutItemDot, { backgroundColor: isSelected ? colors.accent : colors.textTertiary + '40' }]} />
                    <View style={styles.workoutItemLeft}>
                      <Text style={[styles.workoutItemDate, isSelected && styles.workoutItemDateActive]}>
                        {formatWorkoutDate(w.created_at)}
                      </Text>
                      <Text style={styles.workoutItemSub} numberOfLines={1}>
                        {muscles || `${w.total_exercises} exercises`} · {formatDuration(w.duration)}
                      </Text>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={ms(14)} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {mode === 'overview' && (
        <View style={styles.dateRangeRow}>
          <View style={styles.dateSelector}>
            <Text style={styles.dateSelectorLabel}>From</Text>
            <View style={styles.dateSelectorControl}>
              <TouchableOpacity style={styles.dateChevron} onPress={() => shiftDate('start', -1)} activeOpacity={0.7} hitSlop={8}>
                <Ionicons name="chevron-back" size={ms(14)} color={colors.textTertiary} />
              </TouchableOpacity>
              <Text style={styles.dateSelectorValue}>{formatDateShort(startDate)}</Text>
              <TouchableOpacity style={styles.dateChevron} onPress={() => shiftDate('start', 1)} activeOpacity={0.7} hitSlop={8}>
                <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.dateDash}>
            <Ionicons name="arrow-forward" size={ms(12)} color={colors.textTertiary} />
          </View>
          <View style={styles.dateSelector}>
            <Text style={styles.dateSelectorLabel}>To</Text>
            <View style={styles.dateSelectorControl}>
              <TouchableOpacity style={styles.dateChevron} onPress={() => shiftDate('end', -1)} activeOpacity={0.7} hitSlop={8}>
                <Ionicons name="chevron-back" size={ms(14)} color={colors.textTertiary} />
              </TouchableOpacity>
              <Text style={styles.dateSelectorValue}>{formatDateShort(endDate)}</Text>
              <TouchableOpacity style={styles.dateChevron} onPress={() => shiftDate('end', 1)} activeOpacity={0.7} hitSlop={8}>
                <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  ), [mode, variant, selectedWorkout, showPicker, startDate, endDate, workouts, colors, styles, shiftDate]);

  /* ─── Render ──────────────────────────────────────────── */

  return (
    <ShareModal visible={visible} onClose={handleClose} controls={controls}>
      {({ imageUri }) => {
        if (mode === 'workout') {
          if (!workoutData) {
            return (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={ms(32)} color={colors.textTertiary} />
                <Text style={styles.emptyText}>Select a workout to share</Text>
              </View>
            );
          }
          return <WorkoutOverlay backgroundUri={imageUri} data={workoutData} variant={variant} />;
        }
        return (
          <MonthlyOverlay
            backgroundUri={imageUri}
            data={monthlyData}
            startDate={startDate}
            endDate={endDate}
          />
        );
      }}
    </ShareModal>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    controlsWrap: {
      width: '100%',
      marginBottom: sw(12),
    },

    /* Mode tabs */
    modeTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: sw(14),
      padding: sw(3),
      marginBottom: sw(12),
    },
    modeTab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      paddingVertical: sw(10),
      borderRadius: sw(12),
    },
    modeTabActive: {
      backgroundColor: colors.accent,
    },
    modeTabText: {
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
      color: colors.textTertiary,
    },
    modeTabTextActive: {
      color: colors.textOnAccent,
    },

    /* Variant picker */
    variantScroll: {
      marginBottom: sw(10),
      flexGrow: 0,
    },
    variantRow: {
      flexDirection: 'row',
      gap: sw(8),
    },
    variantChip: {
      paddingVertical: sw(7),
      paddingHorizontal: sw(14),
      borderRadius: sw(10),
      backgroundColor: colors.surface,
    },
    variantChipActive: {
      backgroundColor: colors.accent,
    },
    variantChipText: {
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
      color: colors.textTertiary,
    },
    variantChipTextActive: {
      color: colors.textOnAccent,
    },

    /* Workout picker */
    workoutPickerWrap: {
      gap: sw(6),
    },
    workoutPickerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: sw(14),
      paddingVertical: sw(10),
      paddingHorizontal: sw(12),
      gap: sw(10),
    },
    workoutPickerIcon: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(10),
      justifyContent: 'center',
      alignItems: 'center',
    },
    workoutPickerText: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
    },
    workoutList: {
      maxHeight: sw(200),
      backgroundColor: colors.surface,
      borderRadius: sw(14),
    },
    workoutItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(12),
      paddingHorizontal: sw(14),
      gap: sw(10),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    workoutItemActive: {
      backgroundColor: colors.accent + '10',
    },
    workoutItemDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    workoutItemLeft: {
      flex: 1,
      gap: sw(2),
    },
    workoutItemDate: {
      color: colors.textPrimary,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
    },
    workoutItemDateActive: {
      color: colors.accent,
    },
    workoutItemSub: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
    },

    /* Date range */
    dateRangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
    },
    dateSelector: {
      flex: 1,
      alignItems: 'center',
      gap: sw(4),
    },
    dateSelectorLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    dateSelectorControl: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      paddingVertical: sw(8),
      paddingHorizontal: sw(6),
    },
    dateChevron: {
      width: sw(28),
      height: sw(28),
      borderRadius: sw(8),
      justifyContent: 'center',
      alignItems: 'center',
    },
    dateSelectorValue: {
      color: colors.textPrimary,
      fontSize: ms(13),
      fontFamily: Fonts.bold,
      minWidth: sw(56),
      textAlign: 'center',
    },
    dateDash: {
      paddingTop: sw(18),
    },

    /* Empty state */
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: sw(60),
      gap: sw(12),
    },
    emptyText: {
      color: colors.textTertiary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
    },
  });
