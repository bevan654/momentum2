import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useShallow } from 'zustand/shallow';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useBodyFatStore, type BodyFatMethod, type BodyFatEntry } from '../../stores/useBodyFatStore';
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

const METHODS = [
  { key: 'tape' as const, label: 'Tape Method', description: 'Circumference' },
  { key: 'calipers' as const, label: 'Skinfold Calipers', description: 'Skin pinch' },
  { key: 'bia' as const, label: 'Smart Scale', description: 'BIA' },
  { key: 'bod_pod' as const, label: 'Bod Pod', description: 'Air displacement' },
  { key: 'dexa' as const, label: 'DEXA Scan', description: 'X-ray absorptiometry' },
];

const LEGEND: TrendLegendItem[] = [{ label: 'EMA Trend', color: EMA_COLOR }];

const entryKey = (e: BodyFatEntry) => e.id;
const entryValueText = (e: BodyFatEntry) => `${e.value}%`;
const isValidBodyFat = (v: number) => v > 0 && v <= 70;

/* ─── Component ──────────────────────────────────────────── */

interface Props {
  pageIndicator?: React.ReactNode;
}

function BodyFatCard({ pageIndicator }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createTrendStyles(colors), [colors]);
  const ownStyles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const defaultMethod = useProfileSettingsStore((s) => s.defaultBodyFatMethod);

  const { current, change, entries, emaPoints } = useBodyFatStore(
    useShallow((s) => ({ current: s.current, change: s.change, entries: s.entries, emaPoints: s.emaPoints })),
  );
  const fetchBodyFatData = useBodyFatStore((s) => s.fetchBodyFatData);
  const logBodyFat = useBodyFatStore((s) => s.logBodyFat);
  const deleteBodyFat = useBodyFatStore((s) => s.deleteBodyFat);

  const [selectedMethod, setSelectedMethod] = useState<BodyFatMethod>(defaultMethod);
  const [showPicker, setShowPicker] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);

  const { selectedRange, selectedDays, rangeIndex, goShorter, goLonger, dateRange } = useTrendRange('1Y');
  const methodDef = METHODS.find((m) => m.key === selectedMethod)!;

  const chartAnimStyle = useTrendLoad(
    userId,
    `${selectedMethod}_${selectedRange}`,
    (uid) => fetchBodyFatData(uid, selectedMethod, selectedDays),
    [userId, selectedMethod, selectedRange],
    entries,
  );

  const hasData = entries.length > 0;
  const layout = useTrendLayout(entries, emaPoints);

  const handleLog = async (value: number) => {
    if (!userId) return { error: 'Not logged in' };
    return logBodyFat(userId, value, selectedMethod, selectedDays);
  };

  const handleDelete = useCallback((entryId: string) => {
    if (!userId) return;
    deleteBodyFat(userId, entryId, selectedMethod, selectedDays);
  }, [userId, deleteBodyFat, selectedMethod, selectedDays]);

  const handleSelectMethod = useCallback((key: BodyFatMethod) => {
    setSelectedMethod(key);
    setShowPicker(false);
  }, []);

  const openHistory = useCallback(() => setShowHistory(true), []);
  const openLog = useCallback(() => setShowLogModal(true), []);

  return (
    <TrendCard
      title="Body Fat %"
      unit="%"
      hasData={hasData}
      current={current}
      change={change}
      dateRange={dateRange}
      selectedRange={selectedRange}
      rangeIndex={rangeIndex}
      onShorter={goShorter}
      onLonger={goLonger}
      onLog={openLog}
      pageIndicator={pageIndicator}
    >
      {/* Method selector */}
      <Pressable style={ownStyles.methodChip} onPress={() => setShowPicker(true)}>
        <Text style={ownStyles.methodText}>{methodDef.label}</Text>
        <Ionicons name="chevron-down" size={ms(12)} color={colors.textTertiary} />
      </Pressable>

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
          <Text style={styles.emptyText}>Log body fat to see trends</Text>
        </View>
      )}

      {/* Modals */}
      <MethodPickerModal visible={showPicker} onClose={() => setShowPicker(false)} onSelect={handleSelectMethod} selected={selectedMethod} colors={colors} />
      <EntryHistorySheet
        visible={showHistory}
        onClose={() => setShowHistory(false)}
        title={`${methodDef.label} History`}
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
        title="Log Body Fat %"
        subtitle={methodDef.label}
        placeholder="Body fat %"
        isValid={isValidBodyFat}
        invalidMessage="Enter a valid body fat % (0–70)"
      />
    </TrendCard>
  );
}

/* ─── Method Picker Modal ────────────────────────────────── */

const MethodPickerModal = React.memo(function MethodPickerModal({
  visible, onClose, onSelect, selected, colors,
}: {
  visible: boolean; onClose: () => void; onSelect: (key: BodyFatMethod) => void; selected: BodyFatMethod; colors: ThemeColors;
}) {
  const trendStyles = useMemo(() => createTrendStyles(colors), [colors]);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Sheet visible={visible} onClose={onClose} height="55%" bgColor={colors.card}>
      <View style={trendStyles.sheetHeader}>
        <Text style={trendStyles.sheetTitle}>Method</Text>
        <TouchableOpacity onPress={onClose}><Text style={trendStyles.sheetDone}>Done</Text></TouchableOpacity>
      </View>
      <View style={styles.pickerContent}>
        {METHODS.map((m) => {
          const active = m.key === selected;
          return (
            <Pressable key={m.key} style={[styles.pickerItem, active && { backgroundColor: colors.accent }]} onPress={() => onSelect(m.key)}>
              <Text style={[styles.pickerItemText, active && { color: colors.textOnAccent }]}>{m.label}</Text>
              <Text style={[styles.pickerItemSub, active && { color: colors.textOnAccent + 'AA' }]}>{m.description}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
});

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    methodChip: { flexDirection: 'row', alignItems: 'center', gap: sw(6), backgroundColor: colors.surface, borderRadius: sw(8), paddingHorizontal: sw(12), paddingVertical: sw(7), marginBottom: sw(10), alignSelf: 'flex-start' },
    methodText: { color: colors.textPrimary, fontSize: ms(12), lineHeight: ms(16), fontFamily: Fonts.semiBold },
    pickerContent: { paddingHorizontal: sw(20), paddingTop: sw(16), paddingBottom: sw(34), gap: sw(8) },
    pickerItem: { alignItems: 'center', paddingVertical: sw(14), borderRadius: sw(10), backgroundColor: colors.surface },
    pickerItemText: { color: colors.textPrimary, fontSize: ms(14), lineHeight: ms(19), fontFamily: Fonts.semiBold },
    pickerItemSub: { color: colors.textTertiary, fontSize: ms(10), lineHeight: ms(14), fontFamily: Fonts.medium, marginTop: sw(2) },
  });

export default React.memo(BodyFatCard);
