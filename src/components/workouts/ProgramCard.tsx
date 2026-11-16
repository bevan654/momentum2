import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Pressable } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { useAnimatedStyle, interpolate, Extrapolation, type SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useProgramStore, type Program } from '../../stores/useProgramStore';
import { WEEKDAY_SHORT } from '../../constants/dateNames';
import { formatMonthDay } from '../../utils/dateLabels';
import { parseLocalDate } from '../../utils/localDate';

const ACTION_W = sw(80);

/** The red Delete button behind a swiped card; slides in with the swipe. */
function DeleteAction({ progress, onPress, styles, iconColor }: {
  progress: SharedValue<number>;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  iconColor: string;
}) {
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [ACTION_W, 0], Extrapolation.CLAMP) }],
  }));
  return (
    <Animated.View style={[styles.deleteAction, slide]}>
      <TouchableOpacity style={styles.deleteActionInner} onPress={onPress} activeOpacity={0.7}>
        <Ionicons name="trash" size={ms(22)} color={iconColor} />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/**
 * A program on the Plans screen: name, active badge, days per week, the week's day dots, Review
 * Progress (when active), and start / abort. Swipe left to delete.
 */
function ProgramCard({ program, week, onOpen, onReview, onDelete, onAbandon, onStart }: {
  program: Program;
  /** The current program week (only shown while it's active). */
  week: number;
  onOpen: (programId: string) => void;
  onReview: (programId: string) => void;
  onDelete: (programId: string) => void;
  onAbandon: (programId: string) => void;
  onStart: (programId: string) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isActive = program.status === 'active';
  const durationWeeks = useProgramStore.getState().getDurationWeeks(program);

  return (
    <View style={styles.swipeContainer}>
      <ReanimatedSwipeable
        overshootRight={false}
        friction={2}
        rightThreshold={40}
        renderRightActions={(progress) => (
          <DeleteAction
            progress={progress}
            onPress={() => onDelete(program.id)}
            styles={styles}
            iconColor={colors.textOnColor}
          />
        )}
      >
        <View style={styles.programCard}>
          <Pressable
            style={({ pressed }) => [styles.programInfo, pressed && { opacity: 0.7 }]}
            onPress={() => onOpen(program.id)}
          >
            <View style={styles.programNameRow}>
              <Text style={styles.programCardName} numberOfLines={1}>{program.name}</Text>
              {isActive && (
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>
                    ACTIVE{program.end_date ? ` · till ${formatMonthDay(parseLocalDate(program.end_date))}` : ''}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.programCardMeta}>
              {program.days.length} days/week
              {durationWeeks > 0 ? ` · ${durationWeeks} weeks` : ''}
              {isActive ? ` · Week ${week}` : ''}
            </Text>
            <View style={styles.programDayDots}>
              {WEEKDAY_SHORT.map((day, i) => {
                const hasDay = program.days.some((d) => d.day_of_week === i);
                return (
                  <View
                    key={i}
                    style={[styles.programDot, hasDay && styles.programDotFilled]}
                  >
                    <Text style={[styles.programDotText, hasDay && styles.programDotTextFilled]}>
                      {day[0]}
                    </Text>
                  </View>
                );
              })}
            </View>
            {isActive && (
              <TouchableOpacity
                style={styles.progressBtn}
                activeOpacity={0.7}
                onPress={() => onReview(program.id)}
              >
                <Ionicons name="stats-chart" size={ms(12)} color={colors.accent} />
                <Text style={styles.progressBtnText}>REVIEW PROGRESS</Text>
              </TouchableOpacity>
            )}
          </Pressable>
          {isActive ? (
            <TouchableOpacity
              style={[styles.programCardStatus, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
              onPress={() => {
                Alert.alert('Abandon Program', `Stop "${program.name}"? Your workout history is kept.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Abandon', style: 'destructive', onPress: () => onAbandon(program.id) },
                ]);
              }}
            >
              <Text style={styles.abortText}>ABORT</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.programCardStatus}
              onPress={() => onStart(program.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="play" size={ms(18)} color={colors.textOnAccent} />
            </TouchableOpacity>
          )}
        </View>
      </ReanimatedSwipeable>
    </View>
  );
}

export default React.memo(ProgramCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: sw(10),
  },
  deleteAction: {
    width: sw(80),
  },
  deleteActionInner: {
    flex: 1,
    backgroundColor: colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(4),
  },
  deleteActionText: {
    color: colors.textOnColor,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  programCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 0,
  },
  programInfo: {
    flex: 1,
    gap: sw(2),
    padding: sw(14),
  },
  programNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  programCardName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  activeBadge: {
    backgroundColor: colors.positive + '20',
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
  },
  activeBadgeText: {
    color: colors.positive,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  programCardMeta: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  programDayDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(4),
    marginTop: sw(4),
  },
  programDot: {
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  programDotFilled: {
    backgroundColor: colors.accent + '18',
  },
  programDotText: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  programDotTextFilled: {
    color: colors.accent,
  },
  progressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: sw(4),
    marginTop: sw(6),
    paddingVertical: sw(4),
    paddingHorizontal: sw(8),
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '10',
  },
  progressBtnText: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  programCardStatus: {
    justifyContent: 'center',
    alignItems: 'center',
    width: sw(44),
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
  },
  abortText: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});
