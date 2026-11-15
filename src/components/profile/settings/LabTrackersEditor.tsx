import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useProfileSettingsStore, BODY_FAT_METHODS, MEAS_BODY_PARTS, type LabTracker } from '../../../stores/useProfileSettingsStore';
import { DefaultRangePicker, DefaultMethodPicker, DefaultMeasPicker } from './LabTrackerPickers';

/* ─── Lab Trackers Section Header ────────────────────────── */

export function LabTrackersSection() {
  const resetLabTrackers = useProfileSettingsStore((s) => s.resetLabTrackers);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.labSectionHeader}>
      <Text style={styles.sectionTitle}>Lab Trackers</Text>
      <TouchableOpacity onPress={resetLabTrackers} activeOpacity={0.7}>
        <Text style={styles.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Lab Trackers Editor ────────────────────────────────── */

export function LabTrackersEditor() {
  const labTrackers = useProfileSettingsStore((s) => s.labTrackers);
  const setLabTrackerEnabled = useProfileSettingsStore((s) => s.setLabTrackerEnabled);
  const reorderLabTrackers = useProfileSettingsStore((s) => s.reorderLabTrackers);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sorted = useMemo(
    () => [...labTrackers].sort((a, b) => a.order - b.order),
    [labTrackers],
  );

  const ROW_HEIGHT = sw(52);

  const handleSwap = useCallback((draggedId: string, direction: 'up' | 'down') => {
    const idx = sorted.findIndex((t) => t.id === draggedId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reorderLabTrackers(reordered);
  }, [sorted, reorderLabTrackers]);

  return (
    <View>
      <Text style={styles.labHint}>Drag to reorder how they appear in Labs</Text>
      {sorted.map((tracker, index) => (
        <React.Fragment key={tracker.id}>
          {index > 0 && <View style={styles.labDivider} />}
          <LabTrackerRow
            tracker={tracker}
            onToggle={(enabled) => setLabTrackerEnabled(tracker.id, enabled)}
            onSwap={(dir) => handleSwap(tracker.id, dir)}
            rowHeight={ROW_HEIGHT}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            colors={colors}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

const LabTrackerRow = React.memo(function LabTrackerRow({
  tracker,
  onToggle,
  onSwap,
  rowHeight,
  isFirst,
  isLast,
  colors,
}: {
  tracker: LabTracker;
  onToggle: (enabled: boolean) => void;
  onSwap: (direction: 'up' | 'down') => void;
  rowHeight: number;
  isFirst: boolean;
  isLast: boolean;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useSharedValue(0);
  const hasSwapped = useSharedValue(false);

  // Only subscribe to the store slice relevant to this tracker's type
  const defaultWeightRange = useProfileSettingsStore((s) =>
    tracker.id === 'weight' ? s.defaultWeightRange : null,
  );
  const setDefaultWeightRange = useProfileSettingsStore((s) => s.setDefaultWeightRange);
  const defaultBodyFatMethod = useProfileSettingsStore((s) =>
    tracker.id === 'body_fat' ? s.defaultBodyFatMethod : null,
  );
  const setDefaultBodyFatMethod = useProfileSettingsStore((s) => s.setDefaultBodyFatMethod);
  const defaultMeasurement = useProfileSettingsStore((s) =>
    tracker.id === 'measurements' ? s.defaultMeasurement : null,
  );
  const setDefaultMeasurement = useProfileSettingsStore((s) => s.setDefaultMeasurement);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [showMeasPicker, setShowMeasPicker] = useState(false);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      hasSwapped.value = false;
    })
    .onUpdate((e) => {
      'worklet';
      translateY.value = e.translationY;
      if (!hasSwapped.value) {
        if (e.translationY < -rowHeight * 0.4 && !isFirst) {
          hasSwapped.value = true;
          runOnJS(onSwap)('up');
        } else if (e.translationY > rowHeight * 0.4 && !isLast) {
          hasSwapped.value = true;
          runOnJS(onSwap)('down');
        }
      }
    })
    .onEnd(() => {
      'worklet';
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const currentMethodLabel = useMemo(() => {
    if (tracker.id !== 'body_fat' || !defaultBodyFatMethod) return null;
    return BODY_FAT_METHODS.find((m) => m.key === defaultBodyFatMethod)?.short ?? 'Tape';
  }, [tracker.id, defaultBodyFatMethod]);

  const measChipLabel = useMemo(() => {
    if (tracker.id !== 'measurements' || !defaultMeasurement) return null;
    const partDef = MEAS_BODY_PARTS.find((p) => p.key === defaultMeasurement.part);
    if (!partDef) return 'Chest';
    let label = partDef.label;
    if (partDef.hasSides) label += ` ${defaultMeasurement.side === 'left' ? 'L' : 'R'}`;
    if (defaultMeasurement.pump === 'pumped') label += ' · P';
    return label;
  }, [tracker.id, defaultMeasurement]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.labRow, animStyle]}>
        <Ionicons name="reorder-three" size={ms(20)} color={colors.textTertiary} />
        <Text style={[styles.fieldLabel, { flex: 1, marginLeft: sw(10) }]}>{tracker.label}</Text>
        {tracker.id === 'weight' && (
          <TouchableOpacity
            style={styles.methodChip}
            onPress={() => setShowRangePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.methodChipText}>{defaultWeightRange}</Text>
            <Ionicons name="chevron-down" size={ms(12)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {tracker.id === 'measurements' && (
          <TouchableOpacity
            style={styles.methodChip}
            onPress={() => setShowMeasPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.methodChipText}>{measChipLabel}</Text>
            <Ionicons name="chevron-down" size={ms(12)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {tracker.id === 'body_fat' && (
          <TouchableOpacity
            style={styles.methodChip}
            onPress={() => setShowMethodPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.methodChipText}>{currentMethodLabel}</Text>
            <Ionicons name="chevron-down" size={ms(12)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <Switch
          value={tracker.enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.accentRed + '60', true: colors.accentGreen + '60' }}
          thumbColor={tracker.enabled ? colors.accentGreen : colors.accentRed}
        />
        {tracker.id === 'weight' && defaultWeightRange && (
          <DefaultRangePicker
            visible={showRangePicker}
            onClose={() => setShowRangePicker(false)}
            selected={defaultWeightRange}
            onSelect={(key) => { setDefaultWeightRange(key); setShowRangePicker(false); }}
            colors={colors}
          />
        )}
        {tracker.id === 'body_fat' && defaultBodyFatMethod && (
          <DefaultMethodPicker
            visible={showMethodPicker}
            onClose={() => setShowMethodPicker(false)}
            selected={defaultBodyFatMethod}
            onSelect={(key) => { setDefaultBodyFatMethod(key); setShowMethodPicker(false); }}
            colors={colors}
          />
        )}
        {tracker.id === 'measurements' && defaultMeasurement && (
          <DefaultMeasPicker
            visible={showMeasPicker}
            onClose={() => setShowMeasPicker(false)}
            current={defaultMeasurement}
            onSelect={(meas) => { setDefaultMeasurement(meas); setShowMeasPicker(false); }}
            colors={colors}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
});

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: sw(20),
    marginBottom: sw(8),
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  labSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: sw(20),
    marginBottom: sw(8),
  },
  resetText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  labHint: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginBottom: sw(8),
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
  },
  labDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    marginRight: sw(8),
  },
  methodChipText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
});
