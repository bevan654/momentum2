import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import MuscleHeatmap from '../../body/MuscleHeatmap';
import type { WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import { formatWorkoutDate } from './summaryFormat';

/* ═══════════════════════════════════════════════════════════
   HistoricalPage — full-screen workout detail page
   ═══════════════════════════════════════════════════════════ */

export default function HistoricalPage({
  data, colors, editing, onDismiss, onDelete, handleDelete, deleting,
  startEditing, workoutId, statsContent, exerciseContent,
  editFooter, setShowShare, inline,
}: {
  data: WorkoutWithDetails;
  colors: ThemeColors;
  editing: boolean;
  onDismiss: () => void;
  onDelete?: () => void;
  handleDelete: () => void;
  deleting: boolean;
  startEditing: () => void;
  workoutId: string | undefined;
  statsContent: React.ReactNode;
  exerciseContent: React.ReactNode;
  editFooter: React.ReactNode;
  setShowShare: (v: boolean) => void;
  inline?: boolean;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ps = useMemo(() => pageStyles(colors), [colors]);

  return (
    <View style={ps.container}>
      {/* Drag handle */}
      {!inline && (
        <TouchableOpacity onPress={onDismiss} activeOpacity={0.8}>
          <View style={{ alignSelf: 'center', paddingVertical: sw(10) }}>
            <View style={{ width: sw(40), height: sw(5), borderRadius: sw(3), backgroundColor: colors.textTertiary, opacity: 0.5 }} />
          </View>
        </TouchableOpacity>
      )}
      <View style={[ps.pageHeader, inline && { paddingVertical: 0 }]}>
        <TouchableOpacity onPress={onDismiss} style={ps.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={ps.pageHeaderCenter}>
          <Text style={ps.pageTitle} numberOfLines={1}>
            {editing ? 'Edit Workout' : (data as WorkoutWithDetails).programName || 'Workout'}
          </Text>
          {!editing && (
            <Text style={ps.pageDate}>{formatWorkoutDate(data.created_at)}</Text>
          )}
        </View>
        <View style={ps.backBtn} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={ps.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {statsContent}

        {!editing && data.exercises.length > 0 && (
          <MuscleHeatmap exercises={data.exercises} />
        )}

        {exerciseContent}
      </ScrollView>

      {/* Footer */}
      <View style={[ps.footer, !inline && { paddingBottom: sw(12) }, inline && ps.footerInline]}>
        {editing ? editFooter : (
          <View style={styles.footerRow}>
            {onDelete && (
              <TouchableOpacity style={styles.inlineBtn} onPress={handleDelete} activeOpacity={0.7} disabled={deleting}>
                <Ionicons name="trash-outline" size={ms(16)} color={colors.accentRed} />
                <Text style={[styles.inlineBtnText, { color: colors.accentRed }]}>Delete</Text>
              </TouchableOpacity>
            )}
            {workoutId && (
              <TouchableOpacity style={styles.inlineBtn} onPress={startEditing} activeOpacity={0.7}>
                <Ionicons name="pencil" size={ms(16)} color={colors.accent} />
                <Text style={[styles.inlineBtnText, { color: colors.accent }]}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.inlineBtn} onPress={() => setShowShare(true)} activeOpacity={0.7}>
              <Ionicons name="share-outline" size={ms(16)} color={colors.accentGreen} />
              <Text style={[styles.inlineBtnText, { color: colors.accentGreen }]}>Share</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    marginTop: sw(6),
  },
  inlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
  },
  inlineBtnText: {
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
});

/* ─── Page-mode styles (historical full-screen) ────── */

const pageStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
  },
  backBtn: {
    width: sw(36),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageHeaderCenter: {
    flex: 1,
    alignItems: 'center',
    gap: sw(2),
  },
  pageTitle: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  pageDate: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  scrollContent: {
    padding: sw(16),
    paddingBottom: sw(20),
  },
  footer: {
    paddingHorizontal: sw(16),
    paddingTop: sw(12),
  },
  footerInline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: sw(12),
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
});
