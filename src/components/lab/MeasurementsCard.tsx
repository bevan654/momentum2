import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useMeasurementStore, type PumpState, type MeasurementEntry } from '../../stores/useMeasurementStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useProfileSettingsStore } from '../../stores/useProfileSettingsStore';
import Sheet from '../ui/Sheet';
import TrendCard from './trend/TrendCard';
import TrendChart, { type TrendLegendItem } from './trend/TrendChart';
import EntryHistorySheet from './trend/EntryHistorySheet';
import NumberLogModal from './trend/NumberLogModal';
import { useTrendRange, useTrendLoad } from './trend/useTrendRange';
import { useTrendLayout } from './trend/useTrendLayout';
import { EMA_COLOR } from './trend/trendConfig';
import { createTrendStyles } from './trend/trendStyles';

/* ─── Config ─────────────────────────────────────────────── */

const BODY_PARTS = [
  { key: 'chest', label: 'Chest', group: 'Core', hasSides: false },
  { key: 'waist', label: 'Waist', group: 'Core', hasSides: false },
  { key: 'hips', label: 'Hips', group: 'Core', hasSides: false },
  { key: 'neck', label: 'Neck', group: 'Core', hasSides: false },
  { key: 'shoulders', label: 'Shoulders', group: 'Core', hasSides: false },
  { key: 'bicep', label: 'Bicep', group: 'Arms', hasSides: true },
  { key: 'forearm', label: 'Forearm', group: 'Arms', hasSides: true },
  { key: 'thigh', label: 'Thigh', group: 'Legs', hasSides: true },
  { key: 'calf', label: 'Calf', group: 'Legs', hasSides: true },
] as const;

type BodyPartKey = typeof BODY_PARTS[number]['key'];
type Side = 'left' | 'right';

const GROWTH_KEYS = new Set<string>(['chest', 'shoulders', 'bicep', 'forearm', 'thigh', 'calf']);
const GROUPS: string[] = ['Core', 'Arms', 'Legs'];

const LEGEND: TrendLegendItem[] = [{ label: 'EMA Trend', color: EMA_COLOR }];

const entryKey = (e: MeasurementEntry) => e.id;
const entryValueText = (e: MeasurementEntry) => `${e.value} cm`;
const isValidMeasurement = (v: number) => v > 0 && v <= 300;

/* ─── Component ──────────────────────────────────────────── */

interface Props {
  pageIndicator?: React.ReactNode;
}

function MeasurementsCard({ pageIndicator }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createTrendStyles(colors), [colors]);
  const ownStyles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const defaultMeas = useProfileSettingsStore((s) => s.defaultMeasurement);

  const { current, change, entries, emaPoints } = useMeasurementStore(
    useShallow((s) => ({ current: s.current, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const fetchMeasurementData = useMeasurementStore((s) => s.fetchMeasurementData);
  const logMeasurement = useMeasurementStore((s) => s.logMeasurement);
  const deleteMeasurement = useMeasurementStore((s) => s.deleteMeasurement);

  const [selectedPart, setSelectedPart] = useState<BodyPartKey>(defaultMeas.part as BodyPartKey);
  const [selectedSide, setSelectedSide] = useState<Side>(defaultMeas.side as Side);
  const [pumpState, setPumpState] = useState<PumpState>(defaultMeas.pump as PumpState);
  const [showPicker, setShowPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const {
    selectedRange: measRange, selectedDays, rangeIndex, goShorter, goLonger, dateRange,
  } = useTrendRange('1M');

  const partDef = BODY_PARTS.find((p) => p.key === selectedPart)!;
  const side = partDef.hasSides ? selectedSide : null;

  const chartAnimStyle = useTrendLoad(
    userId,
    `${selectedPart}_${side}_${pumpState}_${measRange}`,
    (uid) => fetchMeasurementData(uid, selectedPart, side, pumpState, selectedDays),
    [userId, selectedPart, selectedSide, pumpState, measRange],
    entries,
  );

  const hasData = entries.length > 0;
  const layout = useTrendLayout(entries, emaPoints);

  const displayLabel = partDef.hasSides ? `${partDef.label} (${selectedSide === 'left' ? 'L' : 'R'})` : partDef.label;
  const logLabel = `${displayLabel}${pumpState === 'pumped' ? ' — Pumped' : ''}`;

  const handleLog = async (value: number) => {
    if (!userId) return { error: 'Not logged in' };
    return logMeasurement(userId, value, selectedPart, side, pumpState, selectedDays);
  };

  const handleDelete = useCallback((entryId: string) => {
    if (!userId) return;
    deleteMeasurement(userId, entryId, selectedPart, side, pumpState, selectedDays);
  }, [userId, deleteMeasurement, selectedPart, side, pumpState, selectedDays]);

  const handleSelectPart = useCallback((key: BodyPartKey) => {
    setSelectedPart(key);
    setShowPicker(false);
  }, []);

  const openHistory = useCallback(() => setShowHistory(true), []);
  const openLog = useCallback(() => setShowLogModal(true), []);

  return (
    <TrendCard
      title="Measurements"
      unit=" cm"
      hasData={hasData}
      current={current}
      change={change}
      growth={GROWTH_KEYS.has(selectedPart)}
      dateRange={dateRange}
      selectedRange={measRange}
      rangeIndex={rangeIndex}
      onShorter={goShorter}
      onLonger={goLonger}
      onLog={openLog}
      pageIndicator={pageIndicator}
    >
      {/* Selectors row */}
      <View style={ownStyles.selectorsRow}>
        <Pressable style={ownStyles.partChip} onPress={() => setShowPicker(true)}>
          <Text style={ownStyles.chipText}>{partDef.label}</Text>
          <Ionicons name="chevron-down" size={ms(12)} color={colors.textTertiary} />
        </Pressable>
        {partDef.hasSides && (
          <>
            <Pressable
              style={[ownStyles.toggleChip, selectedSide === 'left' && ownStyles.toggleActive]}
              onPress={() => setSelectedSide('left')}
            >
              <Text style={[ownStyles.toggleText, selectedSide === 'left' && { color: colors.textOnAccent }]}>L</Text>
            </Pressable>
            <Pressable
              style={[ownStyles.toggleChip, selectedSide === 'right' && ownStyles.toggleActive]}
              onPress={() => setSelectedSide('right')}
            >
              <Text style={[ownStyles.toggleText, selectedSide === 'right' && { color: colors.textOnAccent }]}>R</Text>
            </Pressable>
          </>
        )}
        <Pressable
          style={[ownStyles.toggleChip, pumpState === 'no_pump' && ownStyles.toggleActive]}
          onPress={() => setPumpState('no_pump')}
        >
          <Text style={[ownStyles.toggleText, pumpState === 'no_pump' && { color: colors.textOnAccent }]}>Cold</Text>
        </Pressable>
        <Pressable
          style={[ownStyles.toggleChip, pumpState === 'pumped' && ownStyles.toggleActive]}
          onPress={() => setPumpState('pumped')}
        >
          <Text style={[ownStyles.toggleText, pumpState === 'pumped' && { color: colors.textOnAccent }]}>Pump</Text>
        </Pressable>
      </View>

      {/* Chart or empty */}
      {hasData ? (
        <TrendChart
          entries={entries}
          layout={layout}
          trendColor={EMA_COLOR}
          legend={LEGEND}
          animStyle={chartAnimStyle}
          onPress={openHistory}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Log measurements to see trends</Text>
        </View>
      )}

      {/* Modals */}
      <BodyPartPickerModal visible={showPicker} onClose={() => setShowPicker(false)} onSelect={handleSelectPart} selected={selectedPart} colors={colors} />
      <EntryHistorySheet
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        title={`${displayLabel}${pumpState === 'pumped' ? ' (Pumped)' : ''} History`}
        emptyText="No entries yet"
        entries={entries}
        keyOf={entryKey}
        valueText={entryValueText}
        onDelete={handleDelete}
      />
      <NumberLogModal
        visible={showLogModal}
        onClose={() => setShowLogModal(false)}
        onSave={handleLog}
        title="Log Measurement"
        subtitle={logLabel}
        placeholder="Value (cm)"
        isValid={isValidMeasurement}
        invalidMessage="Enter a valid measurement in cm"
      />
    </TrendCard>
  );
}

/* ─── Body Part Picker Modal ─────────────────────────────── */

const BodyPartPickerModal = React.memo(function BodyPartPickerModal({
  visible, onClose, onSelect, selected, colors,
}: {
  visible: boolean; onClose: () => void; onSelect: (key: BodyPartKey) => void; selected: BodyPartKey; colors: ThemeColors;
}) {
  const trendStyles = useMemo(() => createTrendStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Sheet visible={visible} onClose={onClose} height="55%" bgColor={colors.card}>
      <View style={trendStyles.sheetHeader}>
        <Text style={trendStyles.sheetTitle}>Body Part</Text>
        <TouchableOpacity onPress={onClose}><Text style={trendStyles.sheetDone}>Done</Text></TouchableOpacity>
      </View>
      <View style={styles.pickerContent}>
        {GROUPS.map((group) => (
          <View key={group as string}>
            <Text style={styles.pickerGroupLabel}>{group}</Text>
            <View style={styles.pickerGroupGrid}>
              {BODY_PARTS.filter((p) => p.group === group).map((part) => {
                const active = part.key === selected;
                return (
                  <Pressable key={part.key} style={[styles.pickerItem, active && { backgroundColor: colors.accent }]} onPress={() => onSelect(part.key)}>
                    <Text style={[styles.pickerItemText, active && { color: colors.textOnAccent }]}>{part.label}</Text>
                    {part.hasSides && <Text style={[styles.pickerItemSub, active && { color: colors.textOnAccent + 'AA' }]}>L / R</Text>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>
    </Sheet>
  );
});

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    /* Selectors row */
    selectorsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      marginBottom: sw(10),
      flexWrap: 'wrap',
    },
    partChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      paddingHorizontal: sw(12),
      paddingVertical: sw(7),
    },
    chipText: {
      color: colors.textPrimary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.semiBold,
    },
    toggleChip: {
      backgroundColor: colors.surface,
      borderRadius: sw(8),
      paddingHorizontal: sw(10),
      paddingVertical: sw(7),
    },
    toggleActive: {
      backgroundColor: colors.accent,
    },
    toggleText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
    },

    /* Picker */
    pickerContent: { paddingHorizontal: sw(20), paddingTop: sw(16), paddingBottom: sw(34) },
    pickerGroupLabel: { color: colors.textTertiary, fontSize: ms(11), lineHeight: ms(15), fontFamily: Fonts.semiBold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: sw(8), marginTop: sw(4) },
    pickerGroupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: sw(8), marginBottom: sw(16) },
    pickerItem: { flexBasis: '29%', flexGrow: 1, alignItems: 'center', paddingVertical: sw(12), borderRadius: sw(10), backgroundColor: colors.surface } as any,
    pickerItemText: { color: colors.textPrimary, fontSize: ms(14), lineHeight: ms(19), fontFamily: Fonts.semiBold },
    pickerItemSub: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, marginTop: sw(2) },
  });

export default React.memo(MeasurementsCard);
