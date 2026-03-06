import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MiniBodyMap from '../body/MiniBodyMap';
import RankBadge from './RankBadge';
import { computeWorkoutRank } from '../../utils/strengthScore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useWeightStore } from '../../stores/useWeightStore';
import type { WorkoutWithDetails } from '../../stores/useWorkoutStore';

interface Props {
  workout: WorkoutWithDetails;
  onPress: () => void;
}

function formatWorkoutDate(isoString: string): string {
  const d = new Date(isoString);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const h = d.getHours() % 12 || 12;
  const min = d.getMinutes().toString().padStart(2, '0');
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} \u00b7 ${h}:${min} ${ampm}`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatVolume(vol: number): string {
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}k`;
  return `${vol}`;
}

function WorkoutHistoryCard({ workout, onPress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const bodyweight = useWeightStore((s) => s.current) ?? 70;
  const displayExercises = workout.exercises.slice(0, 4);
  const remaining = workout.exercises.length - 4;

  const workoutRank = useMemo(() => {
    if (workout.exercises.length === 0) return null;
    return computeWorkoutRank({
      exercises: workout.exercises.map((ex) => ({
        name: ex.name,
        exercise_type: ex.exercise_type,
        sets: ex.sets.map((s) => ({ kg: s.kg, reps: s.reps, completed: s.completed })),
      })),
      bodyweight,
      catalog: catalogMap,
    });
  }, [workout.exercises, bodyweight, catalogMap]);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Top section: info left, body map right */}
      <View style={styles.topSection}>
        <View style={styles.topLeft}>
          {/* Date row */}
          <View style={styles.dateRow}>
            <View style={styles.dateLeft}>
              <Text style={styles.dateText}>{formatWorkoutDate(workout.created_at)}</Text>
              <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
            </View>
            {workout.ghostUsername && (
              <View style={styles.ghostBadge}>
                <Ionicons name="people" size={ms(10)} color={colors.accentRed} />
                <Text style={styles.ghostText}>vs {workout.ghostUsername}</Text>
              </View>
            )}
            {workout.prCount > 0 && (
              <View style={styles.prBadge}>
                <Text style={styles.prEmoji}>{'\u{1F3C6}'}</Text>
                <Text style={styles.prText}>{workout.prCount} PR{workout.prCount > 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatDuration(workout.duration)}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{workout.completedSets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{workout.totalReps}</Text>
              <Text style={styles.statLabel}>Reps</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatVolume(workout.totalVolume)}</Text>
              <Text style={styles.statLabel}>Volume</Text>
            </View>
          </View>
        </View>

        {/* Mini body heatmap */}
        <MiniBodyMap exercises={workout.exercises} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Exercise list */}
      <View style={styles.exerciseList}>
        {displayExercises.map((ex) => (
          <View key={ex.id} style={styles.exerciseRow}>
            <View style={styles.exerciseLeft}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              {ex.hasPR && (
                <Ionicons name="star" size={ms(12)} color={colors.accentOrange} />
              )}
            </View>
            <Text style={styles.exerciseSets}>{ex.sets.length} sets</Text>
          </View>
        ))}
        {remaining > 0 && (
          <Text style={styles.moreText}>+{remaining} more exercise{remaining > 1 ? 's' : ''}</Text>
        )}
      </View>

      {/* Rank badge */}
      {workoutRank && (
        <View style={styles.rankRow}>
          <RankBadge rank={workoutRank.rank} />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(WorkoutHistoryCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(16),
    marginBottom: sw(12),
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: sw(8),
    marginBottom: sw(12),
  },
  topLeft: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(14),
  },
  dateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  dateText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  ghostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentRed + '20',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
    gap: sw(4),
  },
  ghostText: {
    color: colors.accentRed,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accentOrange + '20',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
    gap: sw(4),
  },
  prEmoji: {
    fontSize: ms(11),
    lineHeight: ms(15),
  },
  prText: {
    color: colors.accentOrange,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(14),
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
    marginBottom: sw(2),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginBottom: sw(10),
  },
  exerciseList: {
    gap: sw(8),
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    flex: 1,
  },
  exerciseName: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },
  exerciseSets: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
  },
  rankRow: {
    marginTop: sw(10),
    paddingTop: sw(10),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  moreText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    marginTop: sw(2),
  },
});
