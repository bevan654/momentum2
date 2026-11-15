import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';
import { type CatalogEntry, titleCase, muscleColor } from './dayEditorData';

/* ─── Memoised exercise row for inline list ──────────── */

export const InlineExerciseRow = memo(function InlineExerciseRow({
  item,
  onSelect,
  colors,
}: {
  item: CatalogEntry;
  onSelect: (name: string, exerciseType: string, category: string) => void;
  colors: ThemeColors;
}) {
  return (
    <TouchableOpacity
      style={inlineRowStyles.row}
      onPress={() => onSelect(item.name, item.exercise_type, item.category)}
      activeOpacity={0.6}
    >
      <View style={[inlineRowStyles.dot, { backgroundColor: muscleColor(item.primary_muscles[0] || '') }]} />
      <View style={inlineRowStyles.info}>
        <Text style={[inlineRowStyles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {titleCase(item.name)}
        </Text>
        <Text style={[inlineRowStyles.cat, { color: colors.textTertiary }]}>
          {item.primary_muscles.map(titleCase).join(', ') || titleCase(item.category || '')}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

const inlineRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
    paddingHorizontal: sw(4),
    gap: sw(10),
  },
  dot: {
    width: sw(8),
    height: sw(8),
    borderRadius: 0,
  },
  info: {
    flex: 1,
    gap: sw(1),
  },
  name: {
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(19),
  },
  cat: {
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
});
