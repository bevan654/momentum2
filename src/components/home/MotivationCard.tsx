import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MotivationCard() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const now = new Date();
  const dayName = DAYS[now.getDay()];
  const dayNum = now.getDate();
  const monthName = MONTHS[now.getMonth()];

  return (
    <View style={styles.container}>
      <Text style={styles.dayName}>{dayName}</Text>
      <Text style={styles.dayNum}>{dayNum}</Text>
      <Text style={styles.month}>{monthName}</Text>
    </View>
  );
}

export default React.memo(MotivationCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: sw(12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  dayNum: {
    color: colors.textPrimary,
    fontSize: ms(36),
    lineHeight: ms(40),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  month: {
    color: colors.accent,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
