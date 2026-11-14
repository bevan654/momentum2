import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import Overlay from '../ui/Overlay';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, sh } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import MacroBars, { type MacroBarItem } from './MacroBars';
import { formatMicroValue } from './dayTotals';

interface MicroGoalItem {
  key: string;
  name: string;
  unit: string;
  color: string;
  dailyGoal: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  eaten: number;
  goal: number;
  macros: MacroBarItem[];
  microGoals: MicroGoalItem[];
  microTotals: Record<string, number>;
}

/** Full breakdown of the day: calories, macros and tracked micronutrients. */
function NutrientDetailOverlay({ visible, onClose, eaten, goal, macros, microGoals, microTotals }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isOver = goal > 0 && eaten > goal;

  return (
    <Overlay visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.statsRow}>
              <Stat label="Eaten" value={eaten.toLocaleString()} styles={styles} />
              <Stat label="Goal" value={goal.toLocaleString()} styles={styles} />
              <Stat
                label={isOver ? 'Over' : 'Left'}
                value={(isOver ? eaten - goal : Math.max(0, goal - eaten)).toLocaleString()}
                styles={styles}
                danger={isOver}
                dangerColor={colors.accentRed}
              />
            </View>

            {macros.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Macros</Text>
                <MacroBars items={macros} />
              </>
            )}

            {microGoals.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Micronutrients</Text>
                <View style={styles.microList}>
                  {microGoals.map((g) => {
                    const value = microTotals[g.key] || 0;
                    const progress = g.dailyGoal > 0 ? Math.min(value / g.dailyGoal, 1) : 0;
                    const over = g.dailyGoal > 0 && value > g.dailyGoal;
                    return (
                      <View key={g.key} style={styles.microRow}>
                        <View style={[styles.microDot, { backgroundColor: g.color }]} />
                        <Text style={styles.microLabel} numberOfLines={1}>{g.name}</Text>
                        <View style={styles.microTrack}>
                          <View
                            style={[
                              styles.microFill,
                              { width: `${progress * 100}%`, backgroundColor: over ? colors.accentRed : g.color },
                            ]}
                          />
                        </View>
                        <Text style={[styles.microValue, over && { color: colors.accentRed }]}>
                          {formatMicroValue(value, g.unit)}
                        </Text>
                        <Text style={styles.microGoal}>/ {formatMicroValue(g.dailyGoal, g.unit)} {g.unit}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Overlay>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Stat({ label, value, styles, danger, dangerColor }: { label: string; value: string; styles: Styles; danger?: boolean; dangerColor?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, danger && { color: dangerColor }]}>{value}</Text>
      <Text style={[styles.statLabel, danger && { color: dangerColor }]}>{label}</Text>
    </View>
  );
}

export default React.memo(NutrientDetailOverlay);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      paddingHorizontal: sw(20),
    },
    sheet: {
      backgroundColor: colors.card,
      borderRadius: sw(20),
      padding: sw(20),
      gap: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      maxHeight: sh(640),
    },
    scroll: {
      flexGrow: 0,
    },
    content: {
      gap: sw(14),
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    stat: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: ms(20),
      lineHeight: ms(26),
      fontFamily: Fonts.bold,
      letterSpacing: -0.4,
    },
    statLabel: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
    sectionLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    microList: {
      gap: sw(9),
    },
    microRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    microDot: {
      width: sw(6),
      height: sw(6),
      borderRadius: sw(3),
    },
    microLabel: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      width: sw(72),
    },
    microTrack: {
      flex: 1,
      height: sw(4),
      borderRadius: sw(2),
      backgroundColor: colors.ring.track,
      overflow: 'hidden',
    },
    microFill: {
      height: '100%',
      borderRadius: sw(2),
    },
    microValue: {
      color: colors.textPrimary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textAlign: 'right',
      minWidth: sw(32),
    },
    microGoal: {
      color: colors.textTertiary,
      fontSize: ms(9),
      lineHeight: ms(12),
      fontFamily: Fonts.medium,
      width: sw(58),
    },
    closeBtn: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      paddingVertical: sw(12),
      alignItems: 'center',
    },
    closeText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
  });
