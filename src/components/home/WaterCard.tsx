import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms } from '../../theme/responsive';

interface Props {
  onOpenSettings?: () => void;
}

export default function WaterCard({ onOpenSettings }: Props) {
  const { water, waterGoal, addWater, undoLastWater } = useSupplementStore();
  const userId = useAuthStore((s) => s.user?.id);
  const progress = Math.min(water / waterGoal, 1);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleAdd = (ml: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addWater(userId, ml);
  };

  const handleUndo = useCallback(() => {
    if (!userId || water <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastWater(userId);
  }, [userId, water, undoLastWater]);

  return (
    <TouchableOpacity style={styles.container} onPress={onOpenSettings} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="water-outline" size={ms(13)} color={colors.water} />
          </View>
          <Text style={styles.title}>Water</Text>
        </View>
        {water > 0 && (
          <TouchableOpacity onPress={handleUndo} hitSlop={8} activeOpacity={0.6}>
            <Ionicons name="arrow-undo" size={ms(13)} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.current}>{water}</Text>
        <Text style={styles.goal}>/{waterGoal}ml</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(250)} activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+250</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(500)} activeOpacity={0.7}>
          <Text style={styles.addButtonText}>+500</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

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
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  iconWrap: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    backgroundColor: colors.water + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  current: {
    color: colors.textPrimary,
    fontSize: ms(26),
    lineHeight: ms(30),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  goal: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.regular,
  },
  progressTrack: {
    height: sw(5),
    backgroundColor: colors.surface,
    borderRadius: sw(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.water,
    borderRadius: sw(2),
  },
  buttons: {
    flexDirection: 'row',
    gap: sw(6),
  },
  addButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingVertical: sw(7),
    alignItems: 'center',
    minHeight: sw(32),
    justifyContent: 'center',
  },
  addButtonText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.semiBold,
  },
});
