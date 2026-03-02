import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { GROUP_LABELS, type MuscleGroup } from '../body/musclePathData';
import { useMuscleAnalysisStore } from '../../stores/useMuscleAnalysisStore';
import type { MuscleGroupAnalysis, MuscleExerciseEntry } from '../../stores/useMuscleAnalysisStore';
import BottomSheet from '../workout-sheet/BottomSheet';

function formatDate(iso: string): string {
  const d = new Date(iso);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`;
  return `${kg.toLocaleString()} kg`;
}

function formatTimeSince(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return 'Just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export default function MuscleDetailModal() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const selectedMuscle = useMuscleAnalysisStore((s) => s.selectedMuscle);
  const setSelectedMuscle = useMuscleAnalysisStore((s) => s.setSelectedMuscle);
  const analysis = useMuscleAnalysisStore((s) => s.analysis);

  const groupData: MuscleGroupAnalysis | null =
    analysis && selectedMuscle ? analysis.groups[selectedMuscle] : null;

  const visible = selectedMuscle !== null && groupData !== null && groupData.exercises.length > 0;

  const handleClose = () => setSelectedMuscle(null);

  // Deduplicate exercises by name+date
  const uniqueExercises = useMemo(() => {
    if (!groupData) return [];
    const seen = new Set<string>();
    const result: MuscleExerciseEntry[] = [];
    for (const ex of groupData.exercises) {
      const key = `${ex.name}|${ex.date}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(ex);
      }
    }
    return result;
  }, [groupData]);

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      height="75%"
      modal
      bgColor={colors.card}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {selectedMuscle ? GROUP_LABELS[selectedMuscle] : ''}
        </Text>
        <Text style={styles.subtitle}>This Week</Text>
        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
          <Text style={styles.closeText}>Done</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      {groupData && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {formatVolume(groupData.weeklyVolume)}
            </Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {groupData.lastTrainedAt
                ? formatTimeSince(groupData.lastTrainedAt)
                : '--'}
            </Text>
            <Text style={styles.statLabel}>Last Trained</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {groupData.sessionCount}
            </Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>
      )}

      {/* Exercise list */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {uniqueExercises.map((ex, idx) => (
          <View key={`${ex.name}-${idx}`} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName} numberOfLines={1}>
                {ex.name}
              </Text>
              {!ex.isPrimary && (
                <View style={styles.secondaryBadge}>
                  <Text style={styles.secondaryText}>Secondary</Text>
                </View>
              )}
            </View>
            <Text style={styles.exerciseDate}>
              {formatDate(ex.date)}
            </Text>
            {/* Sets */}
            <View style={styles.setsGrid}>
              {ex.sets.map((s, si) => (
                <View key={si} style={styles.setChip}>
                  <Text style={styles.setText}>
                    {s.kg}kg x {s.reps}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      marginBottom: sw(16),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(20),
      lineHeight: ms(25),
      fontFamily: Fonts.bold,
    },
    subtitle: {
      color: colors.textTertiary,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.medium,
      marginLeft: sw(8),
    },
    closeBtn: {
      marginLeft: 'auto',
      paddingVertical: sw(4),
      paddingHorizontal: sw(8),
    },
    closeText: {
      color: colors.accent,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.semiBold,
    },
    statsRow: {
      flexDirection: 'row',
      paddingHorizontal: sw(20),
      marginBottom: sw(16),
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
      marginBottom: sw(2),
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
    },
    scrollArea: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: sw(20),
      paddingBottom: sw(34),
    },
    exerciseCard: {
      backgroundColor: colors.surface,
      borderRadius: sw(12),
      padding: sw(14),
      marginBottom: sw(8),
    },
    exerciseHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      marginBottom: sw(2),
    },
    exerciseName: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
      flex: 1,
    },
    secondaryBadge: {
      backgroundColor: colors.accentOrange + '20',
      borderRadius: sw(6),
      paddingHorizontal: sw(8),
      paddingVertical: sw(2),
    },
    secondaryText: {
      color: colors.accentOrange,
      fontSize: ms(10),
      lineHeight: ms(14),
      fontFamily: Fonts.semiBold,
    },
    exerciseDate: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      marginBottom: sw(8),
    },
    setsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(6),
    },
    setChip: {
      backgroundColor: colors.card,
      borderRadius: sw(6),
      paddingHorizontal: sw(10),
      paddingVertical: sw(4),
    },
    setText: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
  });
