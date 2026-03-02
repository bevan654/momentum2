import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MusclePill from './MusclePill';

interface Props {
  name: string;
  sets: number;
  category?: string | null;
  onSetsChange: (delta: number) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export default function ExerciseRow({
  name,
  sets,
  category,
  onSetsChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      {/* Reorder buttons */}
      <View style={styles.reorderCol}>
        <TouchableOpacity
          onPress={onMoveUp}
          disabled={isFirst}
          style={[styles.reorderBtn, isFirst && styles.reorderDisabled]}
        >
          <Ionicons name="chevron-up" size={ms(16)} color={isFirst ? colors.cardBorder : colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onMoveDown}
          disabled={isLast}
          style={[styles.reorderBtn, isLast && styles.reorderDisabled]}
        >
          <Ionicons name="chevron-down" size={ms(16)} color={isLast ? colors.cardBorder : colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Exercise info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {category ? <MusclePill category={category} /> : null}
      </View>

      {/* Set count controls */}
      <View style={styles.setsControl}>
        <TouchableOpacity
          onPress={() => onSetsChange(-1)}
          disabled={sets <= 1}
          style={styles.setBtn}
        >
          <Ionicons name="remove" size={ms(16)} color={sets <= 1 ? colors.cardBorder : colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.setCount}>{sets}</Text>
        <TouchableOpacity onPress={() => onSetsChange(1)} style={styles.setBtn}>
          <Ionicons name="add" size={ms(16)} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Remove */}
      <TouchableOpacity onPress={onRemove} style={styles.removeBtn}>
        <Ionicons name="close-circle" size={ms(20)} color={colors.accentRed} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    padding: sw(12),
    gap: sw(10),
  },
  reorderCol: {
    gap: sw(2),
  },
  reorderBtn: {
    padding: sw(2),
  },
  reorderDisabled: {
    opacity: 0.3,
  },
  info: {
    flex: 1,
    gap: sw(4),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  setsControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  setBtn: {
    width: sw(28),
    height: sw(28),
    borderRadius: sw(14),
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  setCount: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
    lineHeight: ms(22),
    minWidth: sw(20),
    textAlign: 'center',
  },
  removeBtn: {
    padding: sw(4),
  },
});
