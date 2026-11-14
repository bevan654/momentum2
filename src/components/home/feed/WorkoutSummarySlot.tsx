import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useAuthStore } from '../../../stores/useAuthStore';
import type { ActivityFeedItem } from '../../../lib/friendsDatabase';
import type { VolumeExercise } from '../../../utils/muscleVolume';
import { feedDetailSets } from '../../../utils/muscleLoad';
import { DEFAULT_BODYWEIGHT_KG } from '../../../constants/muscleMap';
import WorkoutMiniMaps from '../../body/WorkoutMiniMaps';
import { PHOTO_WIDTH } from './feedHelpers';

const MAX_OVERVIEW_EXERCISES = 5;

const WorkoutSummarySlot = React.memo(function WorkoutSummarySlot({ item }: { item: ActivityFeedItem }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // The feed carries each exercise's totals, not its sets
  const bodyMapExercises: VolumeExercise[] = useMemo(
    () =>
      (item.exercise_details || []).map((ex) => ({
        name: ex.name,
        category: ex.category,
        exercise_type: ex.exercise_type,
        primary_muscles: ex.primary_muscles,
        secondary_muscles: ex.secondary_muscles,
        sets: feedDetailSets(ex),
      })),
    [item.exercise_details],
  );
  // Other users' bodyweight isn't known (or shown): their cards count the default
  const isSelf = useAuthStore((s) => s.user?.id === item.user_id);

  const visibleExercises = (item.exercise_details || []).slice(0, MAX_OVERVIEW_EXERCISES);
  const extra = (item.exercise_details?.length || 0) - visibleExercises.length;

  return (
    <View style={styles.summarySlot}>
      <WorkoutMiniMaps
        exercises={bodyMapExercises}
        bodyweightKg={isSelf ? undefined : DEFAULT_BODYWEIGHT_KG}
        height={sw(88)}
        style={styles.summaryBody}
        columnStyle={styles.summaryBodyCol}
        captionStyle={styles.summaryBodyLabel}
      />

      <View style={styles.summaryList}>
        {visibleExercises.length === 0 ? (
          <Text style={styles.summaryEmpty}>No exercises recorded</Text>
        ) : (
          visibleExercises.map((ex, i) => {
            const best = ex.best_kg > 0
              ? `${Math.round(ex.best_kg)}kg × ${ex.best_reps}`
              : ex.best_reps > 0
                ? `${ex.best_reps} reps`
                : null;
            return (
              <View
                key={`${item.id}-row-${i}`}
                style={[styles.summaryRow, i > 0 && styles.summaryRowDivider]}
              >
                <Text style={styles.summaryName} numberOfLines={1}>
                  {ex.name.replace(/\b\w/g, (c) => c.toUpperCase())}
                </Text>
                <Text style={styles.summaryDetail} numberOfLines={1}>
                  {ex.sets_count > 0 ? `${ex.sets_count} sets` : ''}{best ? ` · ${best}` : ''}
                </Text>
              </View>
            );
          })
        )}
        {extra > 0 && <Text style={styles.summaryMore}>+{extra} more</Text>}
      </View>
    </View>
  );
});

export default WorkoutSummarySlot;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    summarySlot: {
      width: PHOTO_WIDTH,
      paddingTop: sw(4),
      paddingBottom: sw(2),
    },
    summaryBody: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'flex-end',
      gap: sw(20),
      paddingVertical: sw(6),
    },
    summaryBodyCol: {
      alignItems: 'center',
      gap: sw(4),
    },
    summaryBodyLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(11),
      fontFamily: Fonts.bold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    summaryList: {
      paddingHorizontal: sw(14),
      paddingTop: sw(6),
    },
    summaryEmpty: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
      paddingVertical: sw(8),
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: sw(7),
      gap: sw(10),
    },
    summaryRowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    summaryName: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(10),
      lineHeight: ms(13),
      fontFamily: Fonts.semiBold,
      letterSpacing: -0.1,
    },
    summaryDetail: {
      color: colors.textTertiary,
      fontSize: ms(8),
      lineHeight: ms(11),
      fontFamily: Fonts.medium,
    },
    summaryMore: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
      paddingVertical: sw(6),
    },
  });
