import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import type { WidgetSize } from '../../types/widget';

interface Props {
  size: WidgetSize;
}

export default function LogFoodWidget({ size }: Props) {
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('Nutrition');
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
          <View style={[styles.iconWrapSmall, { backgroundColor: colors.accentOrange + '20' }]}>
            <Ionicons name="nutrition-outline" size={ms(22)} color={colors.accentOrange} />
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // Large / Full: icon + label + subtitle + chevron
  if (size === 'large' || size === 'full') {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.innerLarge}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accentOrange + '20' }]}>
            <Ionicons name="nutrition-outline" size={ms(18)} color={colors.accentOrange} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.label}>Log Food</Text>
            <Text style={styles.subtitle}>Track your meals</Text>
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
        <View style={[styles.iconWrap, { backgroundColor: colors.accentOrange + '20' }]}>
          <Ionicons name="nutrition-outline" size={ms(18)} color={colors.accentOrange} />
        </View>
        <Text style={styles.label}>Log Food</Text>
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
