import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

const FeedHeader = React.memo(function FeedHeader({
  feedMode, onToggle,
}: {
  feedMode: 'friends' | 'global';
  onToggle: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onToggle}
      style={styles.headerWrap}
      accessibilityLabel={`Community feed, showing ${feedMode}. Tap to switch.`}
    >
      <Text style={styles.headerTitle}>Community Feed</Text>
      <View style={styles.headerSubRow}>
        <Text style={styles.headerSub}>{feedMode === 'friends' ? 'Friends' : 'Global'}</Text>
        <Ionicons name="swap-horizontal" size={ms(11)} color={colors.textTertiary} />
      </View>
    </TouchableOpacity>
  );
});

export default FeedHeader;

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    headerWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: sw(12),
      paddingTop: sw(4),
      paddingBottom: sw(2),
      marginBottom: sw(8),
    },
    headerTitle: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(22),
      fontFamily: Fonts.extraBold,
      letterSpacing: -0.4,
    },
    headerSubRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    headerSub: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(12),
      fontFamily: Fonts.bold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
  });
