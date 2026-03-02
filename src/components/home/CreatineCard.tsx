import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { sw, ms } from '../../theme/responsive';

export default function CreatineCard() {
  const supplementConfigs = useSupplementStore((s) => s.supplementConfigs);
  const supplementTotals = useSupplementStore((s) => s.supplementTotals);
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const resetSupplement = useSupplementStore((s) => s.resetSupplement);
  const userId = useAuthStore((s) => s.user?.id);
  const creatineConfig = supplementConfigs.find((c) => c.key === 'creatine');
  const creatine = supplementTotals['creatine'] || 0;
  const creatineGoal = creatineConfig?.dailyGoal || 5;
  const taken = creatine >= creatineGoal;
  const progress = creatineGoal > 0 ? Math.min(creatine / creatineGoal, 1) : 0;
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleAdd = (g: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (userId) addSupplement(userId, 'creatine', g);
  };

  const handleReset = useCallback(() => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    resetSupplement(userId, 'creatine');
  }, [userId, resetSupplement]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Ionicons name="flash-outline" size={ms(13)} color={colors.creatine} />
          </View>
          <Text style={styles.title}>Creatine</Text>
        </View>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.current}>{creatine}</Text>
        <Text style={styles.goal}>/{creatineGoal}g</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.buttons}>
        {creatine > 0 && (
          <TouchableOpacity style={styles.undoButton} onPress={handleReset} activeOpacity={0.7}>
            <Ionicons name="arrow-undo" size={ms(14)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {!taken && (
          <>
            <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(5)} activeOpacity={0.7}>
              <Text style={styles.addButtonText}>+5g</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => handleAdd(1)} activeOpacity={0.7}>
              <Text style={styles.addButtonText}>+1g</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
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
    backgroundColor: colors.creatine + '15',
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
    backgroundColor: colors.creatine,
    borderRadius: sw(2),
  },
  buttons: {
    flexDirection: 'row',
    gap: sw(6),
  },
  undoButton: {
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    alignItems: 'center',
    minHeight: sw(32),
    justifyContent: 'center',
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
