import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, Modal, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { getMuscleGroupColor } from '../../constants/muscleGroups';
import MiniBodyMap from '../body/MiniBodyMap';
import type { ActivityFeedItem, FeedExerciseDetail } from '../../lib/friendsDatabase';
import type { ExerciseWithSets } from '../../stores/useWorkoutStore';

interface Props {
  item: ActivityFeedItem;
  onDismiss: () => void;
}

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

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

export default function FeedWorkoutModal({ item, onDismiss }: Props) {
  const displayName = item.profile.username || item.profile.email;
  const exercises = item.exercise_details || [];
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const totalReps = useMemo(() => {
    let sum = 0;
    for (const ex of exercises) {
      if (ex.best_reps > 0 && ex.sets_count > 0) {
        sum += ex.best_reps * ex.sets_count;
      }
    }
    return sum;
  }, [exercises]);

  const muscleGroups = useMemo(() => {
    const set = new Set<string>();
    for (const ex of exercises) {
      if (ex.category) set.add(ex.category);
    }
    return Array.from(set).slice(0, 4);
  }, [exercises]);

  const bodyMapExercises: ExerciseWithSets[] = useMemo(
    () =>
      exercises.map((ex, i) => ({
        id: `${item.id}-${i}`,
        name: ex.name,
        exercise_order: i,
        exercise_type: 'weighted',
        sets:
          ex.total_volume > 0
            ? [{
                id: `${item.id}-${i}-0`,
                set_number: 1,
                kg: ex.total_volume,
                reps: 1,
                completed: true,
                set_type: null,
                isPR: false,
              }]
            : [],
        hasPR: false,
        category: ex.category,
        primary_muscles: ex.primary_muscles,
        secondary_muscles: ex.secondary_muscles,
      })),
    [exercises, item.id],
  );

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onDismiss}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View style={styles.modal}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} activeOpacity={0.6}>
            <Ionicons name="close" size={ms(18)} color={colors.textTertiary} />
          </TouchableOpacity>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{displayName}'s Workout</Text>
              <Text style={styles.dateSubtitle}>{formatDate(item.created_at)}</Text>
            </View>

            {/* Muscle group pills */}
            {muscleGroups.length > 0 && (
              <View style={styles.tagRow}>
                {muscleGroups.map((mg) => {
                  const color = getMuscleGroupColor(mg);
                  return (
                    <View key={mg} style={[styles.musclePill, { backgroundColor: color + '18' }]}>
                      <View style={[styles.muscleDot, { backgroundColor: color }]} />
                      <Text style={[styles.muscleText, { color }]}>{mg}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View key="dur" style={styles.statItem}>
                <Ionicons name="time-outline" size={ms(14)} color={colors.accentBlue} />
                <Text style={styles.statValue}>{formatDuration(item.duration)}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View key="d1" style={styles.statDivider} />
              <View key="vol" style={styles.statItem}>
                <Ionicons name="barbell-outline" size={ms(14)} color={colors.accentOrange} />
                <Text style={styles.statValue}>{formatVolume(item.total_volume)}</Text>
                <Text style={styles.statLabel}>Volume</Text>
              </View>
              <View key="d2" style={styles.statDivider} />
              <View key="sets" style={styles.statItem}>
                <Ionicons name="layers-outline" size={ms(14)} color={colors.accentPink} />
                <Text style={styles.statValue}>{item.total_sets}</Text>
                <Text style={styles.statLabel}>Sets</Text>
              </View>
              {totalReps > 0 && <View key="d3" style={styles.statDivider} />}
              {totalReps > 0 && (
                <View key="reps" style={styles.statItem}>
                  <Ionicons name="repeat-outline" size={ms(14)} color={colors.accentBlue} />
                  <Text style={styles.statValue}>{totalReps}</Text>
                  <Text style={styles.statLabel}>Reps</Text>
                </View>
              )}
            </View>

            {/* Body map — front & back */}
            {bodyMapExercises.length > 0 && (
              <View style={styles.bodySection}>
                <MiniBodyMap
                  exercises={bodyMapExercises}
                  scale={0.4}
                  side="front"
                />
                <MiniBodyMap
                  exercises={bodyMapExercises}
                  scale={0.4}
                  side="back"
                />
              </View>
            )}

            {/* Exercise list */}
            <View style={styles.exerciseDetailList}>
              {exercises.map((ex, i) => (
                <ExerciseRow key={`${ex.name}-${i}`} exercise={ex} colors={colors} styles={styles} />
              ))}
              {exercises.length === 0 &&
                (item.exercise_names || []).map((name, i) => (
                  <View key={`fb-${i}`} style={styles.exerciseSimpleRow}>
                    <View style={styles.indexCircle}>
                      <Text style={styles.indexText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.exerciseName}>{name}</Text>
                  </View>
                ))}
            </View>
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.doneBtn} onPress={onDismiss} activeOpacity={0.8}>
            <Text style={styles.doneBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ExerciseRow({ exercise, colors, styles }: { exercise: FeedExerciseDetail; colors: ThemeColors; styles: ReturnType<typeof createStyles> }) {
  const catColor = exercise.category ? getMuscleGroupColor(exercise.category) : colors.textTertiary;
  const sets = exercise.sets || [];

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
      </View>
      {sets.length > 0 ? (
        <View style={styles.setTable}>
          <View style={styles.setTableHeader}>
            <Text style={[styles.setHeaderText, styles.setColNum]}>SET</Text>
            <Text style={[styles.setHeaderText, styles.setColKg]}>KG</Text>
            <Text style={[styles.setHeaderText, styles.setColReps]}>REPS</Text>
          </View>
          {sets.map((s, i) => (
            <View key={`set-${i}`} style={styles.setRow}>
              <Text style={[styles.setNumText, styles.setColNum]}>{i + 1}</Text>
              <Text style={[styles.setValueText, styles.setColKg]}>{s.kg > 0 ? s.kg : '-'}</Text>
              <Text style={[styles.setValueText, styles.setColReps]}>{s.reps > 0 ? s.reps : '-'}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.exerciseStats}>
          {exercise.best_kg > 0 && (
            <View style={styles.miniStat}>
              <Ionicons name="barbell-outline" size={sw(12)} color={colors.accentOrange} />
              <Text style={styles.miniStatText}>{exercise.best_kg} kg</Text>
            </View>
          )}
          {exercise.best_reps > 0 && (
            <View style={styles.miniStat}>
              <Ionicons name="repeat-outline" size={sw(12)} color={colors.accentBlue} />
              <Text style={styles.miniStatText}>{exercise.best_reps} reps</Text>
            </View>
          )}
        </View>
      )}
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

  /* Header */
  header: {
    alignItems: 'center',
    marginBottom: sw(12),
    marginTop: sw(4),
    gap: sw(4),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(24),
  },
  dateSubtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
  },

  /* Tags */
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: sw(6),
    marginBottom: sw(12),
  },
  musclePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
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

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: sw(12),
    paddingVertical: sw(12),
    marginBottom: sw(14),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: sw(3),
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(28),
    backgroundColor: colors.cardBorder,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(21),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(12),
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  /* Body map */
  bodySection: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: sw(20),
    marginBottom: sw(14),
  },

  /* Exercise list */
  exerciseDetailList: {
    gap: sw(8),
    marginBottom: sw(8),
  },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(10),
    paddingHorizontal: sw(12),
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(6),
  },
  catStrip: {
    width: sw(3),
    height: sw(14),
    borderRadius: sw(2),
    marginRight: sw(8),
  },
  exerciseDetailName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
    flex: 1,
  },
  /* Set table */
  setTable: {
    paddingLeft: sw(11),
    marginTop: sw(2),
  },
  setTableHeader: {
    flexDirection: 'row',
    paddingBottom: sw(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
    marginBottom: sw(2),
  },
  setHeaderText: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  setColNum: {
    width: sw(36),
  },
  setColKg: {
    width: sw(52),
    textAlign: 'center',
  },
  setColReps: {
    width: sw(52),
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    paddingVertical: sw(3),
  },
  setNumText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
  },
  setValueText: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
  },
  exerciseStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    paddingLeft: sw(11),
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  miniStatText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },

  /* Fallback exercise rows */
  exerciseSimpleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingVertical: sw(8),
    paddingHorizontal: sw(12),
    backgroundColor: colors.surface,
    borderRadius: sw(10),
  },
  indexCircle: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(11),
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
    flex: 1,
  },

  /* Button */
  doneBtn: {
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(12),
    alignItems: 'center',
    marginTop: sw(6),
  },
  doneBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
});
