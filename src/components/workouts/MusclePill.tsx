import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { getUICategoryColor } from '../../constants/muscles';

interface Props {
  category: string;
}

export default function MusclePill({ category }: Props) {
  const color = getUICategoryColor(category);

  return (
    <View style={[styles.pill, { backgroundColor: color + '20' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{category}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    borderRadius: sw(12),
    gap: sw(5),
  },
  dot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  text: {
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
  },
});
