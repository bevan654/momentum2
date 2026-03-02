import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import BottomSheet from './BottomSheet';

const DURATIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

interface Props {
  visible: boolean;
  currentDuration: number;
  onSelect: (seconds: number) => void;
  onClose: () => void;
}

function formatDuration(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  }
  return `${s}s`;
}

export default function RestPickerModal({ visible, currentDuration, onSelect, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={sw(280)}
      modal
      bgColor={colors.card}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Rest Timer</Text>
        <View style={styles.grid}>
          {DURATIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.option, d === currentDuration && styles.optionActive]}
              onPress={() => { onSelect(d); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, d === currentDuration && styles.optionTextActive]}>
                {formatDuration(d)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: sw(20),
    paddingBottom: sw(34),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.bold,
    lineHeight: ms(24),
    textAlign: 'center',
    marginBottom: sw(16),
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    justifyContent: 'center',
  },
  option: {
    width: '30%',
    paddingVertical: sw(12),
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    alignItems: 'center',
  },
  optionActive: {
    backgroundColor: colors.accent,
  },
  optionText: {
    color: colors.textSecondary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  optionTextActive: {
    color: colors.textOnAccent,
  },
});
