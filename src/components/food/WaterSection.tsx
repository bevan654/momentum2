import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';

const QUICK_ADD = [250, 500, 750];

function WaterSection() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { water, waterGoal, addWater, undoLastWater } = useSupplementStore(
    useShallow((s) => ({ water: s.water, waterGoal: s.waterGoal, addWater: s.addWater, undoLastWater: s.undoLastWater })),
  );
  const userId = useAuthStore((s) => s.user?.id);
  const progress = waterGoal > 0 ? Math.min(water / waterGoal, 1) : 0;

  const handleAdd = useCallback(
    (ml: number) => {
      if (!userId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      addWater(userId, ml);
    },
    [userId, addWater],
  );

  const handleUndo = useCallback(() => {
    if (!userId || water <= 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    undoLastWater(userId);
  }, [userId, water, undoLastWater]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="water-outline" size={ms(18)} color={colors.water} />
          <Text style={styles.title}>Water</Text>
        </View>
        <View style={styles.headerRight}>
          {water > 0 && (
            <TouchableOpacity onPress={handleUndo} hitSlop={8} activeOpacity={0.6}>
              <Ionicons name="arrow-undo" size={ms(16)} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          <Text style={styles.valueText}>
            <Text style={styles.valueBold}>{water}</Text>
            <Text style={styles.valueGoal}> / {waterGoal} ml</Text>
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Quick add buttons */}
      <View style={styles.buttonRow}>
        {QUICK_ADD.map((ml) => (
          <TouchableOpacity
            key={ml}
            style={styles.addBtn}
            onPress={() => handleAdd(ml)}
            activeOpacity={0.6}
          >
            <Text style={styles.addBtnText}>+{ml}ml</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default React.memo(WaterSection);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(14),
    gap: sw(10),
    ...colors.cardShadow,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.bold,
  },
  valueText: {
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  valueBold: {
    color: colors.textPrimary,
    fontFamily: Fonts.bold,
  },
  valueGoal: {
    color: colors.textTertiary,
    fontFamily: Fonts.medium,
  },
  progressTrack: {
    height: sw(5),
    backgroundColor: colors.surface,
    borderRadius: sw(3),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.water,
    borderRadius: sw(3),
  },
  buttonRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  addBtn: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(10),
    alignItems: 'center',
  },
  addBtnText: {
    color: colors.water,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
  },
});
