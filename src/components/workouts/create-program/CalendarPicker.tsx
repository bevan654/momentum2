import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Overlay from '../../ui/Overlay';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import type { ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';
import { MONTH_LONG } from '../../../constants/dateNames';

const DOW_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ─── Inline calendar picker ────────────────────────── */

export function CalendarPicker({
  visible,
  value,
  minDate,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  value: string | null;
  minDate?: string | null;
  onSelect: (date: string) => void;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const today = new Date();
  const initial = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Monday-based: 0=Mon, 6=Sun
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const goBack = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goForward = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d < new Date(minDate);
  };

  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const v = new Date(value);
    return v.getFullYear() === viewYear && v.getMonth() === viewMonth && v.getDate() === day;
  };

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onSelect(`${viewYear}-${m}-${d}`);
    onClose();
  };

  const st = useMemo(() => calendarStyles(colors), [colors]);

  return (
    <Overlay visible={visible} animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={st.card} onStartShouldSetResponder={() => true}>
          {/* Month nav */}
          <View style={st.navRow}>
            <TouchableOpacity onPress={goBack} style={st.navBtn}>
              <Ionicons name="chevron-back" size={ms(20)} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={st.monthTitle}>{MONTH_LONG[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={goForward} style={st.navBtn}>
              <Ionicons name="chevron-forward" size={ms(20)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={st.dowRow}>
            {DOW_HEADERS.map((d, i) => (
              <Text key={i} style={st.dowText}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={st.grid}>
            {days.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={st.cell} />;
              const disabled = isDisabled(day);
              const selected = isSelected(day);
              const todayCell = isToday(day);
              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  style={st.cell}
                  onPress={() => !disabled && selectDay(day)}
                  activeOpacity={disabled ? 1 : 0.6}
                >
                  <View style={[st.cellInner, todayCell && !selected && st.cellToday, selected && st.cellSelected]}>
                    <Text style={[st.cellText, todayCell && !selected && st.cellTodayText, disabled && st.cellDisabled, selected && st.cellTextSelected]}>
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Overlay>
  );
}

const calendarStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(16),
    width: '85%',
    maxWidth: sw(360),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sw(12),
  },
  navBtn: { padding: sw(4) },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: sw(6),
  },
  dowText: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellInner: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(17),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
  },
  cellDisabled: {
    color: colors.textTertiary,
    opacity: 0.4,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cellTodayText: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  cellTextSelected: {
    color: colors.textOnAccent,
    fontFamily: Fonts.bold,
  },
});
