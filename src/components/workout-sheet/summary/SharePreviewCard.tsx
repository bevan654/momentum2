import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import WorkoutMiniMaps from '../../body/WorkoutMiniMaps';
import { useAuthStore } from '../../../stores/useAuthStore';
import type { WorkoutSummary } from '../../../stores/useActiveWorkoutStore';
import type { VolumeExercise } from '../../../utils/muscleVolume';
import { feedPreviewSets } from '../../../utils/muscleLoad';
import { bestSet } from '../../../utils/feedExerciseDetails';

export type ShareVisibility = 'public' | 'friends' | 'private';

/** Just-finished workout: live preview of the feed post, with title, photo, caption and visibility. */
function SharePreviewCard({
  data,
  shareVisibility, setShareVisibility,
  shareTitle, setShareTitle,
  shareCaption, setShareCaption,
  sharePhotoUrl, sharePhotoUploading,
  handlePickSharePhoto, handleRemoveSharePhoto,
}: {
  data: WorkoutSummary;
  shareVisibility: ShareVisibility;
  setShareVisibility: (v: ShareVisibility) => void;
  shareTitle: string;
  setShareTitle: (v: string) => void;
  shareCaption: string;
  setShareCaption: (v: string) => void;
  sharePhotoUrl: string | null;
  sharePhotoUploading: boolean;
  handlePickSharePhoto: () => void;
  handleRemoveSharePhoto: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userEmail = useAuthStore((s) => s.user?.email);
  const profileUsername = useAuthStore((s) => s.profile?.username);

  // ── Preview data for the inline feed-post preview ─────────────
  const previewRows = useMemo(() => {
    const exs = (data as WorkoutSummary).exercises || [];
    return exs.map((ex) => {
      // Same sets as the post: anything with a weight (assisted is negative) or reps entered
      const completed = ex.sets.filter((s) => s.kg !== 0 || s.reps > 0);
      const best = bestSet(completed);
      return {
        name: ex.name,
        sets_count: completed.length,
        best_kg: best.kg,
        best_reps: best.reps,
      };
    });
  }, [data]);

  // Maps for the feed-post preview, built like the post's own maps: from each exercise's
  // exercise_details.total_volume and total_reps, which count every set with a weight or reps
  // entered, ticked or not.
  const previewExercises = useMemo((): VolumeExercise[] => {
    return ((data as WorkoutSummary).exercises || []).map((ex) => ({
      name: ex.name,
      category: ex.category,
      exercise_type: ex.exercise_type,
      sets: feedPreviewSets(ex.sets),
    }));
  }, [data]);

  return (
    <>
      {/* ── Share to feed ─────────────────────────── */}
      <View style={styles.shareSectionDivider} />
      <Text style={styles.shareSectionTitle}>Share to feed</Text>
      <Text style={styles.shareSectionHint}>This is how your post will appear.</Text>

      {/* Live preview */}
      <View style={styles.previewWrap}>
        {/* Header */}
        <View style={styles.previewHeader}>
          <View style={[styles.previewAvatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.previewAvatarText}>
              {(profileUsername || userEmail || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.previewName}>
              {profileUsername || (userEmail ? userEmail.split('@')[0] : 'You')}
              <Text style={styles.previewNameSep}>  ·  now</Text>
            </Text>
          </View>
          {shareVisibility !== 'public' && (
            <View style={styles.previewVisibilityChip}>
              <Ionicons
                name={shareVisibility === 'private' ? 'lock-closed' : 'people'}
                size={ms(10)}
                color={colors.textSecondary}
              />
              <Text style={styles.previewVisibilityChipText}>
                {shareVisibility === 'private' ? 'Private' : 'Friends'}
              </Text>
            </View>
          )}
        </View>

        {/* Title — editable in-place */}
        <View style={styles.previewTitleRow}>
          <TextInput
            value={shareTitle}
            onChangeText={setShareTitle}
            placeholder="Add a title"
            placeholderTextColor={colors.textTertiary}
            style={styles.previewTitleInput}
            maxLength={60}
            returnKeyType="done"
            selectionColor={colors.accent}
          />
          {shareTitle.length === 0 && (
            <Ionicons name="pencil-outline" size={ms(14)} color={colors.textTertiary} />
          )}
        </View>

        {/* Hero stats */}
        <View style={styles.previewHeroRow}>
          <View style={styles.previewHeroStat}>
            <Text style={styles.previewHeroValue}>
              {(data as WorkoutSummary).totalVolume >= 1000
                ? `${((data as WorkoutSummary).totalVolume / 1000).toFixed(1)}k kg`
                : `${Math.round((data as WorkoutSummary).totalVolume)} kg`}
            </Text>
            <Text style={styles.previewHeroLabel}>Volume</Text>
          </View>
          <View style={styles.previewHeroDivider} />
          <View style={styles.previewHeroStat}>
            <Text style={styles.previewHeroValue}>
              {Math.max(0, Math.floor((data as WorkoutSummary).duration / 60))}
              <Text style={styles.previewHeroUnit}>m</Text>
            </Text>
            <Text style={styles.previewHeroLabel}>Duration</Text>
          </View>
        </View>
        <Text style={styles.previewHeroMeta}>
          {shareTitle.trim() || 'Workout'}  ·  {(data as WorkoutSummary).totalExercises} exercises
        </Text>

        {/* Photo or summary slot */}
        {sharePhotoUrl ? (
          <View>
            <Image source={{ uri: sharePhotoUrl }} style={styles.previewPhoto} resizeMode="cover" />
            <View style={styles.previewPhotoActions}>
              <TouchableOpacity style={styles.previewPhotoActionBtn} onPress={handlePickSharePhoto} disabled={sharePhotoUploading} activeOpacity={0.7}>
                <Ionicons name="refresh" size={ms(13)} color={colors.accent} />
                <Text style={styles.previewPhotoActionText}>Replace</Text>
              </TouchableOpacity>
              <View style={styles.previewPhotoActionDivider} />
              <TouchableOpacity style={styles.previewPhotoActionBtn} onPress={handleRemoveSharePhoto} activeOpacity={0.7}>
                <Ionicons name="trash-outline" size={ms(13)} color={colors.accentRed} />
                <Text style={[styles.previewPhotoActionText, { color: colors.accentRed }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={styles.previewAddPhotoBtn}
              onPress={handlePickSharePhoto}
              disabled={sharePhotoUploading}
              activeOpacity={0.7}
            >
              {sharePhotoUploading ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={ms(16)} color={colors.textSecondary} />
                  <Text style={styles.previewAddPhotoText}>Add a photo</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={styles.previewSlot}>
              {/* Body maps row, centered, matches the summary's body maps */}
              <WorkoutMiniMaps
                exercises={previewExercises}
                height={sw(112)}
                style={styles.previewSlotBody}
                columnStyle={styles.previewSlotBodyCol}
                captionStyle={styles.previewSlotBodyLabel}
              />

              {/* Exercise list — full-width rows with hairline dividers */}
              <View style={styles.previewSlotList}>
                {previewRows.slice(0, 5).map((ex, i) => {
                  const best = ex.best_kg > 0
                    ? `${Math.round(ex.best_kg)}kg × ${ex.best_reps}`
                    : ex.best_reps > 0 ? `${ex.best_reps} reps` : null;
                  return (
                    <View
                      key={i}
                      style={[styles.previewSlotRow, i > 0 && styles.previewSlotRowDivider]}
                    >
                      <Text style={styles.previewSlotName} numberOfLines={1}>
                        {ex.name.replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Text>
                      <Text style={styles.previewSlotDetail} numberOfLines={1}>
                        {ex.sets_count > 0 ? `${ex.sets_count} sets` : ''}{best ? ` · ${best}` : ''}
                      </Text>
                    </View>
                  );
                })}
                {previewRows.length > 5 && (
                  <Text style={styles.previewSlotMore}>+{previewRows.length - 5} more</Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* Caption — editable in-place, clean note field */}
        <View style={styles.previewCaptionWrap}>
          <Text style={styles.previewCaptionLabel}>Caption</Text>
          <View style={styles.previewCaptionRow}>
            <TextInput
              value={shareCaption}
              onChangeText={setShareCaption}
              placeholder="Add a caption…"
              placeholderTextColor={colors.textTertiary}
              style={styles.previewCaptionInput}
              multiline
              maxLength={500}
              selectionColor={colors.accent}
            />
            {shareCaption.length === 0 && (
              <Ionicons name="pencil-outline" size={ms(13)} color={colors.textTertiary} style={styles.previewCaptionHintIcon} />
            )}
          </View>
        </View>
      </View>

      <Text style={styles.fieldLabel}>Visibility</Text>
      <View style={styles.visibilityList}>
        {([
          { value: 'public', label: 'Everyone', icon: 'globe-outline', hint: 'Visible on the global feed' },
          { value: 'friends', label: 'Friends', icon: 'people', hint: 'Only friends can see this post' },
          { value: 'private', label: 'Private', icon: 'lock-closed', hint: 'Don’t post to any feed' },
        ] as const).map((opt, i) => {
          const active = shareVisibility === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.visibilityRow, i > 0 && styles.visibilityRowDivider]}
              onPress={() => setShareVisibility(opt.value)}
              activeOpacity={0.6}
            >
              <Ionicons
                name={opt.icon as any}
                size={ms(20)}
                color={active ? colors.accent : colors.textSecondary}
                style={{ width: ms(22) }}
              />
              <View style={styles.visibilityTextWrap}>
                <Text style={[styles.visibilityLabel, active && { color: colors.accent }]}>
                  {opt.label}
                </Text>
                <Text style={styles.visibilityHint}>{opt.hint}</Text>
              </View>
              <View style={[styles.visibilityRadio, active && styles.visibilityRadioActive]}>
                {active && <View style={styles.visibilityRadioInner} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

export default React.memo(SharePreviewCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  shareSectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
    marginTop: sw(18),
    marginBottom: sw(14),
    marginHorizontal: -sw(2),
  },
  shareSectionTitle: {
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.bold,
  },
  shareSectionHint: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.regular,
    marginTop: sw(3),
    marginBottom: sw(12),
  },
  previewWrap: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 0,
    overflow: 'hidden',
    marginBottom: sw(18),
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingHorizontal: sw(12),
    paddingVertical: sw(8),
  },
  previewAvatar: {
    width: sw(30),
    height: sw(30),
    borderRadius: sw(15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewAvatarText: {
    color: '#fff',
    fontSize: ms(12),
    fontFamily: Fonts.bold,
  },
  previewName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(16),
    fontFamily: Fonts.bold,
  },
  previewNameSep: {
    color: colors.textTertiary,
    fontFamily: Fonts.semiBold,
  },
  previewVisibilityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    paddingHorizontal: sw(6),
    paddingVertical: sw(3),
    backgroundColor: colors.surface,
    borderRadius: sw(4),
  },
  previewVisibilityChipText: {
    color: colors.textSecondary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  previewHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(14),
    paddingTop: sw(2),
  },
  previewHeroStat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  previewHeroValue: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(24),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  previewHeroUnit: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  previewHeroLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: sw(1),
  },
  previewHeroDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.cardBorder,
    marginHorizontal: sw(10),
  },
  previewHeroMeta: {
    color: colors.textSecondary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.semiBold,
    paddingHorizontal: sw(14),
    paddingTop: sw(4),
    paddingBottom: sw(8),
  },
  previewPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.cardBorder,
  },
  previewPhotoActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  previewPhotoActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(5),
    paddingVertical: sw(10),
  },
  previewPhotoActionDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  previewPhotoActionText: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  previewAddPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    marginHorizontal: sw(14),
    marginBottom: sw(8),
    paddingVertical: sw(10),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.surface,
  },
  previewAddPhotoText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.2,
  },
  previewSlot: {
    paddingTop: sw(8),
    paddingBottom: sw(4),
  },
  previewSlotBody: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: sw(20),
    paddingVertical: sw(10),
  },
  previewSlotBodyCol: {
    alignItems: 'center',
    gap: sw(4),
  },
  previewSlotBodyLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewSlotList: {
    paddingHorizontal: sw(14),
    paddingTop: sw(6),
  },
  previewSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: sw(10),
    gap: sw(10),
  },
  previewSlotRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  previewSlotName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.1,
  },
  previewSlotDetail: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.medium,
  },
  previewSlotMore: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    paddingVertical: sw(8),
  },
  previewCaptionWrap: {
    paddingHorizontal: sw(14),
    paddingTop: sw(12),
    paddingBottom: sw(12),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  previewCaptionLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: sw(6),
  },
  previewCaptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: sw(4),
  },
  previewCaptionInput: {
    flex: 1,
    minWidth: sw(120),
    color: colors.textPrimary,
    fontSize: ms(12),
    lineHeight: ms(17),
    fontFamily: Fonts.medium,
    padding: 0,
    margin: 0,
    minHeight: ms(18),
    textAlignVertical: 'top',
  },
  previewCaptionHintIcon: {
    marginLeft: sw(2),
    marginTop: sw(2),
  },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    paddingHorizontal: sw(14),
    paddingTop: sw(2),
    paddingBottom: sw(8),
  },
  previewTitleInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(22),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
    padding: 0,
    margin: 0,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    marginTop: sw(14),
    marginBottom: sw(6),
  },
  visibilityList: {
    marginTop: sw(2),
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    paddingVertical: sw(12),
  },
  visibilityRowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  visibilityTextWrap: {
    flex: 1,
  },
  visibilityLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
  },
  visibilityHint: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
  visibilityRadio: {
    width: sw(20),
    height: sw(20),
    borderRadius: sw(10),
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityRadioActive: {
    borderColor: colors.accent,
  },
  visibilityRadioInner: {
    width: sw(10),
    height: sw(10),
    borderRadius: sw(5),
    backgroundColor: colors.accent,
  },
});
