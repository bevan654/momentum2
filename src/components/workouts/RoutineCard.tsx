import React, { useMemo, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import type { Routine } from '../../stores/useRoutineStore';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Props {
  routine: Routine;
  onPress: () => void;
  onPlay: () => void;
  onDelete: () => void;
}

export default function RoutineCard({ routine, onPress, onPlay, onDelete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const swipeableRef = useRef<Swipeable>(null);

  const handleDelete = useCallback(() => {
    swipeableRef.current?.close();
    onDelete();
  }, [onDelete]);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={handleDelete}
      activeOpacity={0.7}
    >
      <Ionicons name="trash" size={ms(22)} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  ), [handleDelete, styles]);

  // Collect unique primary muscles across all exercises
  const muscleList = useMemo(() => {
    const muscles = new Set<string>();
    for (const ex of routine.exercises) {
      const entry = catalogMap[ex.name];
      if (entry?.primary_muscles) {
        for (const m of entry.primary_muscles) muscles.add(m);
      } else if (entry?.category) {
        muscles.add(entry.category);
      }
    }
    if (muscles.size === 0) return [];
    return [...muscles].map((m) => m.toUpperCase());
  }, [routine.exercises, catalogMap]);

  return (
    <View style={styles.swipeContainer}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={2}
      >
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Pressable style={({ pressed }) => [styles.info, pressed && styles.cardPressed]} onPress={onPress}>
              <Text style={styles.name} numberOfLines={1}>{routine.name}</Text>
              <Text style={styles.sub}>
                {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
              </Text>
              {routine.days.length > 0 && (
                <View style={styles.chipRow}>
                  {routine.days.map((d) => (
                    <View key={d} style={styles.dayChip}>
                      <Text style={styles.dayText}>{DAY_NAMES[d].toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              )}
              {muscleList.length > 0 && (
                <View style={styles.chipRow}>
                  {muscleList.map((m) => (
                    <View key={m} style={styles.muscleChip}>
                      <Text style={styles.muscleText}>{m}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
            <TouchableOpacity style={styles.playBtn} onPress={onPlay} activeOpacity={0.7}>
              <Ionicons name="play" size={ms(18)} color={colors.textOnAccent} />
            </TouchableOpacity>
          </View>
        </View>
      </Swipeable>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: sw(10),
    borderWidth: sw(2),
    borderColor: colors.cardBorder,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
  },
  cardRow: {
    flexDirection: 'row',
  },
  cardPressed: {
    opacity: 0.7,
  },
  info: {
    flex: 1,
    gap: sw(2),
    padding: sw(14),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
  },
  sub: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(4),
    marginTop: sw(2),
  },
  muscleChip: {
    backgroundColor: colors.accent + '18',
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: 0,
  },
  muscleText: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    letterSpacing: 0.5,
  },
  dayChip: {
    backgroundColor: colors.accentOrange + '18',
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: 0,
  },
  dayText: {
    color: colors.accentOrange,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    letterSpacing: 0.5,
  },
  playBtn: {
    width: sw(44),
    borderRadius: 0,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAction: {
    backgroundColor: colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    width: sw(80),
    gap: sw(4),
  },
  deleteText: {
    color: '#fff',
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
});
