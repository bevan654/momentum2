import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

const QUOTES = [
  'The only bad workout is the one that didn\u2019t happen.',
  'Discipline is choosing between what you want now and what you want most.',
  'Strong is what happens when you run out of weak.',
  'Your body can stand almost anything. It\u2019s your mind you have to convince.',
  'The pain you feel today will be the strength you feel tomorrow.',
  'Don\u2019t wish for it. Work for it.',
  'Results happen over time, not overnight.',
  'Push harder than yesterday if you want a different tomorrow.',
  'Small daily improvements are the key to staggering long-term results.',
  'You don\u2019t have to be extreme, just consistent.',
  'Strive for progress, not perfection.',
  'It never gets easier. You just get stronger.',
  'Success starts with self-discipline.',
  'The difference between try and triumph is a little umph.',
  'Sweat is fat crying.',
  'No shortcuts. Just hard work.',
  'One more rep. One step closer.',
  'Train insane or remain the same.',
  'Fall in love with taking care of yourself.',
  'What seems impossible today will one day become your warm-up.',
  'You are stronger than you think.',
  'Consistency beats intensity.',
  'Show up. Work hard. Repeat.',
  'Every rep counts.',
  'Trust the process.',
  'Be stronger than your excuses.',
  'Earn your rest.',
  'Make yourself proud.',
  'Today\u2019s effort, tomorrow\u2019s results.',
  'Champions train, losers complain.',
  'Embrace the grind.',
];

function getDailyQuote(): string {
  const now = new Date();
  const dayIndex = Math.floor(now.getTime() / 86400000) % QUOTES.length;
  return QUOTES[dayIndex];
}

function MotivationCard() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const quote = useMemo(() => getDailyQuote(), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={ms(13)} color={colors.accent} />
        </View>
        <Text style={styles.title}>Daily Fuel</Text>
      </View>

      <Text style={styles.quote} numberOfLines={3}>{quote}</Text>
    </View>
  );
}

export default React.memo(MotivationCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(14),
    justifyContent: 'space-between',
    gap: sw(8),
    ...colors.cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    backgroundColor: colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  quote: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(19),
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
});
