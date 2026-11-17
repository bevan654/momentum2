import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';

const FeedSeparator = React.memo(function FeedSeparator() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.separator}>
      <View style={styles.separatorLine} />
      <View style={styles.separatorDot} />
      <View style={styles.separatorIconWrap}>
        <Ionicons name="barbell" size={ms(11)} color={colors.textTertiary} />
      </View>
      <View style={styles.separatorDot} />
      <View style={styles.separatorLine} />
    </View>
  );
});

export default FeedSeparator;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    separator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 0,
      paddingHorizontal: sw(20),
      gap: sw(6),
      backgroundColor: colors.background,
    },
    separatorLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
    },
    separatorDot: {
      width: sw(3),
      height: sw(3),
      borderRadius: sw(2),
      backgroundColor: colors.cardBorder,
    },
    separatorIconWrap: {
      paddingHorizontal: sw(4),
    },
  });
