import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  /** Smaller dots, no day letters (for tight tiles). */
  compact?: boolean;
  /** Show each day's sets (or "Rest") under the letter (Home streak section). */
  showSets?: boolean;
  week: { key: string; day: number; trained: boolean; sets?: number; isToday: boolean }[];
}

/** Last 7 days: a filled dot for each day with a workout, today ringed. */
function WeekDots({ week, compact, showSets }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.row}>
      {week.map((d) => (
        <View key={d.key} style={s.col}>
          <View style={[s.dot, compact && s.dotSmall, d.trained && s.dotOn, d.isToday && s.dotToday]} />
          {!compact && <Text style={[s.letter, d.isToday && s.letterToday]}>{LETTERS[d.day]}</Text>}
          {showSets && (
            <Text style={[s.sets, d.trained && s.setsOn]} numberOfLines={1}>
              {d.trained ? `${d.sets ?? 0} sets` : d.isToday ? 'Today' : 'Rest'}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

export default React.memo(WeekDots);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    col: { alignItems: 'center', gap: sw(5) },
    dot: {
      width: sw(14),
      height: sw(14),
      borderRadius: sw(7),
      // Visible on any surface (the page, a card or a tile).
      backgroundColor: colors.textTertiary + '40',
    },
    dotSmall: { width: sw(11), height: sw(11), borderRadius: sw(5.5) },
    sets: { color: colors.textTertiary + 'AA', fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.medium },
    setsOn: { color: colors.textSecondary, fontFamily: Fonts.semiBold },
    dotOn: { backgroundColor: colors.streak },
    dotToday: { borderWidth: sw(2), borderColor: colors.textPrimary },
    letter: { color: colors.textTertiary, fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.semiBold },
    letterToday: { color: colors.textPrimary },
  });
