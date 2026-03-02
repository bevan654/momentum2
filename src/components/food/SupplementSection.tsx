import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useAuthStore } from '../../stores/useAuthStore';

function SupplementSection() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const supplementConfigs = useSupplementStore((s) => s.supplementConfigs);
  const supplementTotals = useSupplementStore((s) => s.supplementTotals);
  const addSupplement = useSupplementStore((s) => s.addSupplement);
  const resetSupplement = useSupplementStore((s) => s.resetSupplement);
  const userId = useAuthStore((s) => s.user?.id);

  const handleToggle = useCallback((key: string, dailyGoal: number, taken: boolean) => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (taken) {
      resetSupplement(userId, key);
    } else {
      addSupplement(userId, key, dailyGoal);
    }
  }, [userId, addSupplement, resetSupplement]);

  if (supplementConfigs.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flask-outline" size={ms(18)} color={colors.creatine} />
          <Text style={styles.title}>Supplements</Text>
        </View>
      </View>

      {supplementConfigs.map((config) => {
        const total = supplementTotals[config.key] || 0;
        const taken = total >= config.dailyGoal;

        return (
          <TouchableOpacity
            key={config.key}
            onPress={() => handleToggle(config.key, config.dailyGoal, taken)}
            style={[styles.supplementRow, taken && styles.supplementDone]}
            activeOpacity={0.6}
          >
            <View style={styles.supplementLeft}>
              <Ionicons
                name={taken ? 'checkmark-circle' : 'ellipse-outline'}
                size={ms(20)}
                color={taken ? colors.accentGreen : colors.textTertiary}
              />
              <Text style={[styles.supplementName, taken && styles.supplementNameDone]}>
                {config.name}
              </Text>
            </View>
            <Text style={[styles.supplementAmount, taken && styles.supplementAmountDone]}>
              {total}{config.unit} / {config.dailyGoal}{config.unit}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default React.memo(SupplementSection);

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
  title: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.bold,
  },
  supplementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingHorizontal: sw(14),
    paddingVertical: sw(12),
  },
  supplementDone: {
    backgroundColor: colors.accentGreen + '12',
  },
  supplementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  supplementName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  supplementNameDone: {
    color: colors.accentGreen,
  },
  supplementAmount: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  supplementAmountDone: {
    color: colors.accentGreen,
  },
});
