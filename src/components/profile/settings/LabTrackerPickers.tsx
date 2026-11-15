import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Pressable } from 'react-native';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { BODY_FAT_METHODS, MEAS_BODY_PARTS, TIME_RANGES, type BodyFatMethod, type MeasDefault, type MeasBodyPart, type MeasSide, type MeasPump, type TimeRange } from '../../../stores/useProfileSettingsStore';
import Sheet from '../../ui/Sheet';

/* ─── Default Range Picker ───────────────────────────────── */

export const DefaultRangePicker = React.memo(function DefaultRangePicker({
  visible,
  onClose,
  selected,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  selected: TimeRange;
  onSelect: (key: TimeRange) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Sheet visible={visible} onClose={onClose} height="45%" bgColor={colors.card}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Default Range</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pickerList}>
        {TIME_RANGES.map((range) => {
          const active = range.key === selected;
          return (
            <Pressable
              key={range.key}
              style={[styles.pickerOption, active && { backgroundColor: colors.accent }]}
              onPress={() => onSelect(range.key)}
            >
              <Text style={[styles.pickerOptionText, active && { color: colors.textOnAccent }]}>
                {range.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
});

/* ─── Default Method Picker ──────────────────────────────── */

export const DefaultMethodPicker = React.memo(function DefaultMethodPicker({
  visible,
  onClose,
  selected,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  selected: BodyFatMethod;
  onSelect: (key: BodyFatMethod) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Sheet visible={visible} onClose={onClose} height="45%" bgColor={colors.card}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Default Method</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pickerList}>
        {BODY_FAT_METHODS.map((method) => {
          const active = method.key === selected;
          return (
            <Pressable
              key={method.key}
              style={[styles.pickerOption, active && { backgroundColor: colors.accent }]}
              onPress={() => onSelect(method.key)}
            >
              <Text style={[styles.pickerOptionText, active && { color: colors.textOnAccent }]}>
                {method.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
});

/* ─── Default Measurement Picker ─────────────────────────── */

const MEAS_GROUPS = ['Core', 'Arms', 'Legs'];

export const DefaultMeasPicker = React.memo(function DefaultMeasPicker({
  visible,
  onClose,
  current,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  current: MeasDefault;
  onSelect: (meas: MeasDefault) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [part, setPart] = useState<MeasBodyPart>(current.part);
  const [side, setSide] = useState<MeasSide>(current.side);
  const [pump, setPump] = useState<MeasPump>(current.pump);

  // Sync local state when current changes (e.g. reset)
  useEffect(() => {
    setPart(current.part);
    setSide(current.side);
    setPump(current.pump);
  }, [current.part, current.side, current.pump]);


  const handleDone = useCallback(() => {
    onSelect({ part, side, pump });
  }, [part, side, pump, onSelect]);

  return (
    <Sheet visible={visible} onClose={onClose} height="75%" bgColor={colors.card}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Default View</Text>
        <TouchableOpacity onPress={handleDone}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.measPickerScroll}>
        {/* Side toggle */}
        <Text style={styles.measPickerLabel}>Side</Text>
        <View style={styles.measToggleRow}>
          <Pressable
            style={[styles.measToggleChip, side === 'left' && { backgroundColor: colors.accent }]}
            onPress={() => setSide('left')}
          >
            <Text style={[styles.measToggleText, side === 'left' && { color: colors.textOnAccent }]}>Left</Text>
          </Pressable>
          <Pressable
            style={[styles.measToggleChip, side === 'right' && { backgroundColor: colors.accent }]}
            onPress={() => setSide('right')}
          >
            <Text style={[styles.measToggleText, side === 'right' && { color: colors.textOnAccent }]}>Right</Text>
          </Pressable>
        </View>

        {/* Pump toggle */}
        <Text style={styles.measPickerLabel}>Pump State</Text>
        <View style={styles.measToggleRow}>
          <Pressable
            style={[styles.measToggleChip, pump === 'no_pump' && { backgroundColor: colors.accent }]}
            onPress={() => setPump('no_pump')}
          >
            <Text style={[styles.measToggleText, pump === 'no_pump' && { color: colors.textOnAccent }]}>No Pump</Text>
          </Pressable>
          <Pressable
            style={[styles.measToggleChip, pump === 'pumped' && { backgroundColor: colors.accent }]}
            onPress={() => setPump('pumped')}
          >
            <Text style={[styles.measToggleText, pump === 'pumped' && { color: colors.textOnAccent }]}>Pumped</Text>
          </Pressable>
        </View>

        {/* Body part grid */}
        <Text style={styles.measPickerLabel}>Body Part</Text>
        {MEAS_GROUPS.map((group) => (
          <View key={group}>
            <Text style={styles.measGroupLabel}>{group}</Text>
            <View style={styles.measPartGrid}>
              {MEAS_BODY_PARTS.filter((p) => p.group === group).map((bp) => {
                const active = bp.key === part;
                return (
                  <Pressable
                    key={bp.key}
                    style={[styles.pickerOption, { flexBasis: '29%', flexGrow: 1 }, active && { backgroundColor: colors.accent }]}
                    onPress={() => setPart(bp.key)}
                  >
                    <Text style={[styles.pickerOptionText, active && { color: colors.textOnAccent }]}>{bp.label}</Text>
                    {bp.hasSides && (
                      <Text style={[styles.measPartSub, active && { color: colors.textOnAccent + 'AA' }]}>L / R</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </Sheet>
  );
});

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sw(20),
    paddingBottom: sw(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  pickerDoneText: {
    color: colors.accent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  pickerList: {
    paddingHorizontal: sw(20),
    paddingTop: sw(16),
    paddingBottom: sw(34),
    gap: sw(8),
  },
  pickerOption: {
    alignItems: 'center',
    paddingVertical: sw(14),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
  },
  pickerOptionText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(19),
    fontFamily: Fonts.semiBold,
  },
  measPickerScroll: {
    paddingHorizontal: sw(20),
    paddingTop: sw(16),
    paddingBottom: sw(34),
  },
  measPickerLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: sw(8),
    marginTop: sw(4),
  },
  measToggleRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(16),
  },
  measToggleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(8),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  measToggleText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  measGroupLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sw(8),
    marginTop: sw(4),
  },
  measPartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    marginBottom: sw(12),
  },
  measPartSub: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
});
