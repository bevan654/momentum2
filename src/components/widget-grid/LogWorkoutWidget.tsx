import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import type { WidgetSize } from '../../types/widget';

interface Props {
  size: WidgetSize;
}

export default function LogWorkoutWidget({ size }: Props) {
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isActive) {
      showSheet();
    } else {
      startWorkout();
    }
  };

  // Small: icon only, centered
  if (size === 'small') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.innerSmall}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrapSmall, { backgroundColor: colors.accentGreen + '20' }]}>
            <Ionicons name="barbell-outline" size={ms(22)} color={colors.accentGreen} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Large / Full: icon + label + subtitle
  if (size === 'large' || size === 'full') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.innerLarge}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accentGreen + '20' }]}>
            <Ionicons name="barbell-outline" size={ms(18)} color={colors.accentGreen} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.label}>
              {isActive ? 'Resume Workout' : 'Log Workout'}
            </Text>
            <Text style={styles.subtitle}>
              {isActive ? 'Continue your session' : 'Start a new session'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={ms(18)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  }

  // Medium (default): icon + label
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.inner}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.accentGreen + '20' }]}>
          <Ionicons name="barbell-outline" size={ms(18)} color={colors.accentGreen} />
        </View>
        <Text style={styles.label}>
          {isActive ? 'Resume' : 'Log Workout'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
  },
  innerSmall: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(14),
    paddingHorizontal: sw(10),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(14),
    paddingHorizontal: sw(14),
    gap: sw(10),
  },
  innerLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(16),
    paddingHorizontal: sw(16),
    gap: sw(12),
  },
  iconWrapSmall: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
  },
  label: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
});
