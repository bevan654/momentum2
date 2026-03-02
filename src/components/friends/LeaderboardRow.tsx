import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { LeaderboardEntry } from '../../lib/friendsDatabase';
import AvatarCircle from './AvatarCircle';

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

interface Props {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  accentColor: string;
  valueLabel: string;
}

function LeaderboardRow({ entry, isCurrentUser, accentColor, valueLabel }: Props) {
  const rank = entry.rank || 0;
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  const displayName = entry.profile.username || entry.profile.email;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.row, isCurrentUser && styles.currentUserRow, isCurrentUser && { borderColor: accentColor }]}>
      {/* Rank */}
      <View style={styles.rankWrap}>
        {medal ? (
          <Text style={styles.medal}>{medal}</Text>
        ) : (
          <Text style={styles.rankText}>#{rank}</Text>
        )}
      </View>

      {/* Avatar */}
      <AvatarCircle
        username={entry.profile.username}
        email={entry.profile.email}
        size={sw(34)}
        bgColor={isCurrentUser ? colors.accentGreen : undefined}
      />

      {/* Name */}
      <Text style={styles.name} numberOfLines={1}>
        {isCurrentUser ? 'You' : displayName}
      </Text>

      {/* Value */}
      <View style={styles.valueWrap}>
        <Text style={[styles.value, isCurrentUser && { color: accentColor }]}>
          {formatValue(entry.value)}
        </Text>
        <Text style={styles.valueLabel}>{valueLabel}</Text>
      </View>
    </View>
  );
}

function formatValue(val: number): string {
  if (val >= 10000) return `${(val / 1000).toFixed(1)}k`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
  return String(val);
}

export default React.memo(LeaderboardRow);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: sw(12),
    paddingHorizontal: sw(12),
    paddingVertical: sw(11),
    gap: sw(10),
    backgroundColor: colors.card,
    borderRadius: sw(12),
    marginBottom: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  currentUserRow: {
    backgroundColor: colors.accent + '15',
    borderColor: colors.accent + '40',
  },
  rankWrap: {
    width: sw(30),
    alignItems: 'center',
  },
  medal: {
    fontSize: ms(20),
    fontFamily: Fonts.medium,
    lineHeight: ms(25),
  },
  rankText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  valueWrap: {
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
  },
  value: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
  },
  valueLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
});
