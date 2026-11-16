import React from 'react';
import { View, Text } from 'react-native';
import { MONTH_SHORT, DAY_SHORT } from '../../../constants/dateNames';
import type { HistoryStyles } from './historyStyles';
import type { HistoryEntry } from './useExerciseHistory';

function fmtDate(d: Date): string {
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function daysAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  if (diff < 30) return `${Math.floor(diff / 7)} week${Math.floor(diff / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diff / 30)} month${Math.floor(diff / 30) > 1 ? 's' : ''} ago`;
}

/** One session in the HISTORY list: date, the sets table and a volume/reps/top-weight footer. */
function HistoryTable({ styles, entry }: { styles: HistoryStyles; entry: HistoryEntry }) {
  return (
    <View style={styles.historyCard}>
      {/* Date row */}
      <View style={styles.historyDateRow}>
        <Text style={styles.historyDate}>{fmtDate(new Date(entry.date))}</Text>
        <Text style={styles.historyAgo}>{daysAgo(entry.date)}</Text>
      </View>

      {/* Table header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, styles.tableColSet]}>SET</Text>
        <Text style={[styles.tableHeaderCell, styles.tableColKg]}>KG</Text>
        <Text style={[styles.tableHeaderCell, styles.tableColReps]}>REPS</Text>
        <View style={styles.tableColType} />
      </View>

      {/* Table rows */}
      {entry.sets.map((s, si) => (
        <View
          key={si}
          style={[
            styles.tableRow,
            si % 2 === 0 && styles.tableRowAlt,
            !s.completed && styles.tableRowSkipped,
          ]}
        >
          <Text style={[styles.tableCell, styles.tableCellSet, styles.tableColSet]}>{si + 1}</Text>
          <Text style={[styles.tableCell, styles.tableColKg, !s.completed && styles.tableCellDim]}>
            {s.kg > 0 ? `${s.kg}` : '—'}
          </Text>
          <Text style={[styles.tableCell, styles.tableColReps, !s.completed && styles.tableCellDim]}>
            {s.reps}
          </Text>
          <View style={styles.tableColType}>
            {s.set_type && s.set_type !== 'working' ? (
              <View style={styles.setTypeBadge}>
                <Text style={styles.setTypeBadgeText}>
                  {s.set_type === 'warmup' ? 'W' : s.set_type === 'drop' ? 'D' : s.set_type === 'failure' ? 'F' : s.set_type.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : !s.completed ? (
              <Text style={styles.tableSkipLabel}>skip</Text>
            ) : null}
          </View>
        </View>
      ))}

      {/* Summary footer */}
      <View style={styles.tableFooter}>
        <Text style={styles.tableFooterText}>
          {entry.totalVolume > 0 ? `${entry.totalVolume.toLocaleString()}kg vol` : '—'}
        </Text>
        <Text style={styles.tableFooterDot}> · </Text>
        <Text style={styles.tableFooterText}>{entry.totalReps} reps</Text>
        {entry.maxWeight > 0 && (
          <>
            <Text style={styles.tableFooterDot}> · </Text>
            <Text style={styles.tableFooterText}>top {entry.maxWeight}kg</Text>
          </>
        )}
      </View>
    </View>
  );
}

export default React.memo(HistoryTable);
