import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { RankInfo } from '../../utils/strengthScore';

const RANK_COLORS: Record<string, string> = {
  Novice: '#8E8E93',
  Apprentice: '#6B7280',
  Intermediate: '#3B82F6',
  Advanced: '#8B5CF6',
  Elite: '#F59E0B',
  Master: '#EF4444',
  Grandmaster: '#EC4899',
  Titan: '#F97316',
  Mythic: '#34D399',
  Legend: '#FFD700',
};

export function getRankColor(rankName: string): string {
  return RANK_COLORS[rankName] || '#8E8E93';
}

interface Props {
  rank: RankInfo;
  size?: 'small' | 'normal';
}

export default function RankBadge({ rank, size = 'small' }: Props) {
  const color = getRankColor(rank.name);
  const isSmall = size === 'small';

  return (
    <View style={[styles.pill, { backgroundColor: color + '18' }, isSmall && styles.pillSmall]}>
      <Ionicons name="shield" size={isSmall ? ms(9) : ms(11)} color={color} />
      <Text style={[styles.text, { color }, isSmall && styles.textSmall]}>{rank.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(8),
    paddingVertical: sw(3),
    borderRadius: sw(10),
    gap: sw(4),
  },
  pillSmall: {
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
  },
  text: {
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
  },
  textSmall: {
    fontSize: ms(10),
    lineHeight: ms(14),
  },
});
