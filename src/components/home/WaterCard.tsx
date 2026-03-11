import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms } from '../../theme/responsive';

const DROPLET_ML = 250;

export default function WaterCard() {
  const { water, waterGoal, addWater, undoLastWater } = useSupplementStore();
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const totalDroplets = Math.max(Math.round(waterGoal / DROPLET_ML), 1);
  const filledDroplets = Math.min(Math.floor(water / DROPLET_ML), totalDroplets);

  const handleTap = useCallback(() => {
    if (!userId || filledDroplets >= totalDroplets) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addWater(userId, DROPLET_ML);
  }, [userId, filledDroplets, totalDroplets, addWater]);

  const handleUndo = useCallback(() => {
    if (!userId || water <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastWater(userId);
  }, [userId, water, undoLastWater]);

  return (
    <TouchableOpacity style={styles.container} onPress={handleTap} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.title}>Water</Text>
        <View style={styles.headerRight}>
          <Text style={styles.count}>{water}/{waterGoal}</Text>
          {water > 0 && (
            <TouchableOpacity onPress={handleUndo} hitSlop={8} activeOpacity={0.6}>
              <Ionicons name="arrow-undo" size={ms(10)} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <View style={styles.grid}>
        {Array.from({ length: totalDroplets }, (_, i) => (
          <Ionicons
            key={i}
            name={i < filledDroplets ? 'water' : 'water-outline'}
            size={ms(14)}
            color={i < filledDroplets ? colors.water : colors.textTertiary + '30'}
          />
        ))}
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(10),
    gap: sw(6),
    ...colors.cardShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  count: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.medium,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(2),
  },
});
