import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { MealConfig } from '../../stores/useFoodLogStore';
import { toLocalDateString } from '../../utils/localDate';
import FoodSegmentChips, { type SegmentOption } from './ui/FoodSegmentChips';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface DateChip {
  date: string;
  label: string;
  sub: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The next 14 days as plan-ahead chips, built when called (so "Today" is right after midnight). */
export function buildDateChips(): DateChip[] {
  const chips: DateChip[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    chips.push({
      date: toLocalDateString(d),
      label: i === 0 ? 'Today' : i === 1 ? 'Tmrw' : DAYS[d.getDay()],
      sub: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
    });
  }
  return chips;
}

type When = 'now' | 'planned';
const WHEN_OPTIONS: SegmentOption<When>[] = [
  { key: 'now', label: 'Log now', icon: 'add-circle-outline' },
  { key: 'planned', label: 'Plan ahead', icon: 'calendar-outline' },
];

interface Props {
  meals: MealConfig[];
  mealSlot: string;
  onMealSelect: (slot: string) => void;
  isPlanned: boolean;
  onPlannedChange: (planned: boolean) => void;
  dateChips: DateChip[];
  targetDate: string;
  onDateSelect: (date: string) => void;
}

/** Which meal the food goes in, and whether it's eaten now or planned for a day. */
function FoodLogOptions({ meals, mealSlot, onMealSelect, isPlanned, onPlannedChange, dateChips, targetDate, onDateSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const enabled = useMemo(() => meals.filter((m) => m.enabled), [meals]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Meal</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {enabled.map((m) => {
          const active = m.slot === mealSlot;
          return (
            <Pressable
              key={m.slot}
              onPress={() => onMealSelect(m.slot)}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={m.label}
            >
              <Ionicons name={(m.icon || 'restaurant-outline') as IconName} size={ms(14)} color={active ? colors.textOnAccent : colors.textSecondary} />
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>When</Text>
      <View style={styles.segment}>
        <FoodSegmentChips options={WHEN_OPTIONS} value={isPlanned ? 'planned' : 'now'} onChange={(k) => onPlannedChange(k === 'planned')} />
      </View>

      {isPlanned && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {dateChips.map((chip) => {
            const active = chip.date === targetDate;
            return (
              <Pressable
                key={chip.date}
                onPress={() => onDateSelect(chip.date)}
                style={[styles.dateChip, active && styles.dateChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${chip.label}, ${chip.sub}`}
              >
                <Text style={[styles.dateLabel, active && styles.dateTextActive]}>{chip.label}</Text>
                <Text style={[styles.dateSub, active && styles.dateTextActive]}>{chip.sub}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

export default React.memo(FoodLogOptions);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: sw(8),
    },
    label: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: sw(4),
    },
    chipRow: {
      gap: sw(8),
      paddingRight: sw(16),
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      paddingHorizontal: sw(14),
      paddingVertical: sw(9),
      borderRadius: sw(999),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
    },
    chipTextActive: {
      color: colors.textOnAccent,
    },
    segment: {
      marginHorizontal: -sw(16),
    },
    dateChip: {
      alignItems: 'center',
      minWidth: sw(58),
      paddingHorizontal: sw(10),
      paddingVertical: sw(8),
      borderRadius: sw(14),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    dateChipActive: {
      backgroundColor: colors.accentGreen,
      borderColor: colors.accentGreen,
    },
    dateLabel: {
      color: colors.textPrimary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.bold,
    },
    dateSub: {
      color: colors.textTertiary,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.medium,
    },
    dateTextActive: {
      color: colors.textOnAccent,
    },
  });
