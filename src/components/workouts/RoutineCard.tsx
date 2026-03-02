import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { getMuscleGroupColor } from '../../constants/muscleGroups';
import type { Routine } from '../../stores/useRoutineStore';

interface Props {
  routine: Routine;
  onPlay: () => void;
  onDelete: () => void;
}

export default function RoutineCard({ routine, onPlay, onDelete }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const firstCategory = routine.exercises[0]?.exercise_type || 'Custom';
  const barColor = getMuscleGroupColor(firstCategory === 'weighted' ? 'Custom' : firstCategory);

  const handleDelete = () => {
    Alert.alert('Delete Routine', `Delete "${routine.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={styles.card}>
      <View style={[styles.colorBar, { backgroundColor: colors.accent }]} />
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.textArea}>
            <Text style={styles.name} numberOfLines={1}>{routine.name}</Text>
            <Text style={styles.subtitle}>
              {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.playBtn} onPress={onPlay} activeOpacity={0.7}>
              <Ionicons name="play" size={ms(18)} color={colors.textOnAccent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
              <Ionicons name="trash-outline" size={ms(18)} color={colors.accentRed} />
            </TouchableOpacity>
          </View>
        </View>

      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: sw(14),
    overflow: 'hidden',
    marginBottom: sw(10),
  },
  colorBar: {
    width: sw(4),
  },
  content: {
    flex: 1,
    padding: sw(14),
    gap: sw(10),
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  textArea: {
    flex: 1,
    gap: sw(2),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  subtitle: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(14),
  },
  playBtn: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(17),
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
