import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

const QUOTES = [
  { text: "The only bad workout is the one that didn't happen.", author: "Unknown" },
  { text: "Discipline is choosing between what you want now and what you want most.", author: "Abraham Lincoln" },
  { text: "The body achieves what the mind believes.", author: "Napoleon Hill" },
  { text: "Don't count the days. Make the days count.", author: "Muhammad Ali" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "You don't have to be extreme, just consistent.", author: "Unknown" },
  { text: "What hurts today makes you stronger tomorrow.", author: "Jay Cutler" },
  { text: "The harder you work, the luckier you get.", author: "Gary Player" },
  { text: "Your body can stand almost anything. It's your mind you have to convince.", author: "Unknown" },
  { text: "Fall in love with the process and the results will come.", author: "Eric Thomas" },
  { text: "The pain you feel today will be the strength you feel tomorrow.", author: "Unknown" },
  { text: "Champions are made when nobody is watching.", author: "Unknown" },
  { text: "Motivation gets you started. Habit keeps you going.", author: "Jim Ryun" },
  { text: "Push yourself because no one else is going to do it for you.", author: "Unknown" },
  { text: "Every rep counts. Every set matters.", author: "Unknown" },
  { text: "Strength does not come from the body. It comes from the will.", author: "Unknown" },
  { text: "The only way to define your limits is by going beyond them.", author: "Arthur C. Clarke" },
  { text: "Progress, not perfection.", author: "Unknown" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "If it doesn't challenge you, it won't change you.", author: "Fred DeVito" },
  { text: "Sweat is just fat crying.", author: "Unknown" },
  { text: "The clock is ticking. Are you becoming the person you want to be?", author: "Greg Plitt" },
  { text: "Sore today. Strong tomorrow.", author: "Unknown" },
  { text: "No one is born strong. You earn it.", author: "Unknown" },
  { text: "You are one workout away from a good mood.", author: "Unknown" },
  { text: "Results happen over time, not overnight. Work hard, stay consistent, and be patient.", author: "Unknown" },
  { text: "Once you learn to quit, it becomes a habit.", author: "Vince Lombardi" },
  { text: "The iron never lies to you.", author: "Henry Rollins" },
  { text: "When you want to succeed as bad as you want to breathe, then you'll be successful.", author: "Eric Thomas" },
  { text: "Obsessed is a word the lazy use to describe the dedicated.", author: "Unknown" },
  { text: "Good things come to those who sweat.", author: "Unknown" },
];

function getDailyQuote() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return QUOTES[dayOfYear % QUOTES.length];
}

const FUEL_COLOR = '#FBBF24';

export default React.memo(function DailyFuelCard() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const quote = useMemo(() => getDailyQuote(), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name="flame-outline" size={ms(12)} color={FUEL_COLOR} />
        </View>
        <Text style={styles.title}>Daily Fuel</Text>
      </View>
      <Text style={styles.quote}>{quote.text}</Text>
      <Text style={styles.author}>— {quote.author}</Text>
    </View>
  );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(14),
    gap: sw(10),
    ...colors.cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    marginBottom: sw(2),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    backgroundColor: FUEL_COLOR + '15',
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
    fontSize: ms(11.5),
    lineHeight: ms(17),
    fontFamily: Fonts.medium,
    fontStyle: 'italic',
  },
  author: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.regular,
    marginTop: sw(4),
  },
});
