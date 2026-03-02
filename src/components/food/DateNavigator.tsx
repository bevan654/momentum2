import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

const TODAY_STR = toDateStr(new Date());

/** Mon–Sun week containing the given date */
function getWeek(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(d);
  mon.setDate(d.getDate() + offset);

  const days: { dateStr: string; label: string; dayNum: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    days.push({ dateStr: toDateStr(day), label: DAY_LABELS[i], dayNum: day.getDate() });
  }
  return days;
}

function getMonthLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const name = MONTH_NAMES[d.getMonth()];
  return d.getFullYear() === new Date().getFullYear() ? name : `${name} ${d.getFullYear()}`;
}

interface Props {
  selectedDate: string;
  onDateSelect: (date: string) => void;
}

function DateNavigator({ selectedDate, onDateSelect }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const week = useMemo(() => getWeek(selectedDate), [selectedDate]);
  const monthLabel = useMemo(() => getMonthLabel(selectedDate), [selectedDate]);
  const viewingToday = selectedDate === TODAY_STR;

  const jumpWeek = useCallback(
    (dir: 1 | -1) => {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(d.getDate() + dir * 7);
      onDateSelect(toDateStr(d));
    },
    [selectedDate, onDateSelect],
  );

  const goToday = useCallback(() => onDateSelect(TODAY_STR), [onDateSelect]);

  return (
    <View style={styles.outer}>
      <View style={styles.headerRow}>
        <Text style={styles.monthText}>{monthLabel}</Text>
        {!viewingToday && (
          <TouchableOpacity onPress={goToday} style={styles.todayBtn} activeOpacity={0.7}>
            <Text style={styles.todayBtnText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.weekRow}>
        <TouchableOpacity
          onPress={() => jumpWeek(-1)}
          style={styles.arrow}
          activeOpacity={0.5}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={ms(14)} color={colors.textTertiary} />
        </TouchableOpacity>

        {week.map((day) => {
          const sel = day.dateStr === selectedDate;
          const today = day.dateStr === TODAY_STR;
          return (
            <TouchableOpacity
              key={day.dateStr}
              onPress={() => onDateSelect(day.dateStr)}
              style={styles.dayCell}
              activeOpacity={0.6}
            >
              <Text
                style={[
                  styles.dayLabel,
                  sel && styles.dayLabelSel,
                  !sel && today && styles.dayLabelToday,
                ]}
              >
                {day.label}
              </Text>
              <View
                style={[
                  styles.pill,
                  sel && { backgroundColor: colors.accent },
                  !sel && today && styles.pillToday,
                ]}
              >
                <Text
                  style={[
                    styles.dayNum,
                    sel && styles.dayNumSel,
                    !sel && today && styles.dayNumToday,
                  ]}
                >
                  {day.dayNum}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          onPress={() => jumpWeek(1)}
          style={styles.arrow}
          activeOpacity={0.5}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default React.memo(DateNavigator);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    outer: {
      paddingHorizontal: sw(16),
      paddingTop: sw(4),
      paddingBottom: sw(8),
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: sw(8),
    },
    monthText: {
      color: colors.textSecondary,
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
    },
    todayBtn: {
      backgroundColor: colors.accent + '15',
      paddingHorizontal: sw(10),
      paddingVertical: sw(3),
      borderRadius: sw(8),
    },
    todayBtnText: {
      color: colors.accent,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
    },
    weekRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    arrow: {
      paddingHorizontal: sw(2),
      paddingVertical: sw(4),
      justifyContent: 'center',
      alignItems: 'center',
    },
    dayCell: {
      flex: 1,
      alignItems: 'center',
      gap: sw(4),
    },
    dayLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.medium,
    },
    dayLabelSel: {
      color: colors.accent,
      fontFamily: Fonts.bold,
    },
    dayLabelToday: {
      color: colors.accent,
    },
    pill: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(16),
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillToday: {
      borderWidth: 1.5,
      borderColor: colors.accent + '40',
    },
    dayNum: {
      color: colors.textPrimary,
      fontSize: ms(13),
      fontFamily: Fonts.bold,
    },
    dayNumSel: {
      color: colors.textOnAccent,
    },
    dayNumToday: {
      color: colors.accent,
    },
  });
