import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Modal,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore, type ActiveExercise } from '../../stores/useActiveWorkoutStore';

// Notes shown inline (via expand) before switching to a scrollable modal.
const PREV_NOTES_INLINE_CAP = 4;

// The 3 selectable note colors, mapped to theme tokens.
const NOTE_COLOR_OPTIONS: { key: string; token: 'accentGreen' | 'accentOrange' | 'accentRed' }[] = [
  { key: 'green', token: 'accentGreen' },
  { key: 'orange', token: 'accentOrange' },
  { key: 'red', token: 'accentRed' },
];

function formatNoteDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Number of notes shown on the header badge: previous notes + today's (if written). */
export function noteCount(exercise: ActiveExercise): number {
  const today = exercise.notes && exercise.notes.trim().length > 0 ? 1 : 0;
  return (exercise.prevNotes?.length ?? 0) + today;
}

interface Props {
  exercise: ActiveExercise;
  exerciseIndex: number;
  onExerciseFocus?: (exerciseIndex: number) => void;
}

/**
 * Expanded notes section for an exercise card: previous notes (read-only,
 * newest first) and today's editable note. Collapsing is handled by the card.
 */
function ExerciseNotes({ exercise, exerciseIndex, onExerciseFocus }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setExerciseNotes = useActiveWorkoutStore((s) => s.setExerciseNotes);
  const setExerciseNoteColor = useActiveWorkoutStore((s) => s.setExerciseNoteColor);

  // `notesOpen` means actively editing today's note.
  const hasNote = !!exercise.notes && exercise.notes.trim().length > 0;
  const [notesOpen, setNotesOpen] = useState(false);
  // Previous-note history: collapsed to the latest by default. Small histories
  // expand inline; large ones open a scrollable modal.
  const [showAllPrev, setShowAllPrev] = useState(false);
  const [notesHistoryOpen, setNotesHistoryOpen] = useState(false);

  const prevNotes = exercise.prevNotes ?? [];
  const prevUseModal = prevNotes.length > PREV_NOTES_INLINE_CAP;
  const visiblePrev = !prevUseModal && showAllPrev ? prevNotes : prevNotes.slice(0, 1);

  const noteColorValue = useCallback(
    (key?: string): string | null => {
      const opt = NOTE_COLOR_OPTIONS.find((o) => o.key === key);
      return opt ? colors[opt.token] : null;
    },
    [colors],
  );
  const todayColor = noteColorValue(exercise.noteColor);

  return (
    <View>
      {/* Previous notes — read-only history (newest first) */}
      {prevNotes.length > 0 && (
        <View style={styles.notesPrevWrap}>
          {visiblePrev.map((n, i) => {
            const c = noteColorValue(n.color);
            return (
              <View
                key={`prevnote-${i}`}
                style={[
                  styles.notesPrevItem,
                  i > 0 && styles.notesPrevItemDivider,
                  c && { borderLeftWidth: sw(3), borderLeftColor: c },
                ]}
              >
                <Text style={[styles.notesPrevDate, c && { color: c }]}>{formatNoteDate(n.date)}</Text>
                <Text style={styles.notesPrevText}>{n.note}</Text>
              </View>
            );
          })}
          {prevNotes.length > 1 && (
            <TouchableOpacity
              style={[styles.notesPrevToggle, styles.notesPrevItemDivider]}
              onPress={() => (prevUseModal ? setNotesHistoryOpen(true) : setShowAllPrev((v) => !v))}
              activeOpacity={0.6}
            >
              <Text style={styles.notesPrevToggleText}>
                {prevUseModal
                  ? `View all ${prevNotes.length} notes`
                  : showAllPrev
                  ? 'Show less'
                  : `Show ${prevNotes.length - 1} earlier ${prevNotes.length - 1 === 1 ? 'note' : 'notes'}`}
              </Text>
              <Ionicons
                name={prevUseModal ? 'chevron-forward' : showAllPrev ? 'chevron-up' : 'chevron-down'}
                size={ms(11)}
                color={colors.accent}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Today's note — editable */}
      {notesOpen ? (
        <View style={styles.notesWrap}>
          <TextInput
            style={[styles.notesInput, todayColor && { borderLeftWidth: sw(3), borderLeftColor: todayColor }]}
            value={exercise.notes ?? ''}
            onChangeText={(t) => setExerciseNotes(exerciseIndex, t)}
            onFocus={() => onExerciseFocus?.(exerciseIndex)}
            placeholder="Add a note..."
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus={!hasNote}
          />
          <View style={styles.notesEditFooter}>
            <View style={styles.notesSwatches}>
              {NOTE_COLOR_OPTIONS.map((opt) => {
                const selected = exercise.noteColor === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setExerciseNoteColor(exerciseIndex, selected ? undefined : opt.key)}
                    style={[styles.swatch, { backgroundColor: colors[opt.token] }, selected && styles.swatchSelected]}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    {selected && <Ionicons name="checkmark" size={ms(12)} color="#fff" />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.notesEditActions}>
              {(hasNote || !!exercise.noteColor) && (
                <TouchableOpacity
                  style={styles.notesDeleteBtn}
                  onPress={() => {
                    setExerciseNotes(exerciseIndex, '');
                    setExerciseNoteColor(exerciseIndex, undefined);
                    Keyboard.dismiss();
                    setNotesOpen(false);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={ms(14)} color={colors.accentRed} />
                  <Text style={styles.notesDeleteText}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.notesSaveBtn}
                onPress={() => {
                  Keyboard.dismiss();
                  setNotesOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="checkmark" size={ms(14)} color={colors.accent} />
                <Text style={styles.notesSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : hasNote ? (
        <TouchableOpacity
          style={[styles.notesDisplay, todayColor && { borderLeftWidth: sw(3), borderLeftColor: todayColor }]}
          onPress={() => setNotesOpen(true)}
          activeOpacity={0.6}
        >
          <Text style={styles.notesDisplayText}>{exercise.notes}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={styles.notesAddBtn}
          onPress={() => setNotesOpen(true)}
          activeOpacity={0.6}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          <Ionicons name="add" size={ms(13)} color={colors.textTertiary} />
          <Text style={styles.notesAddText}>Add today's note</Text>
        </TouchableOpacity>
      )}

      {/* Full note history — scrollable modal for large histories */}
      {notesHistoryOpen && (
        <Modal transparent animationType="slide" onRequestClose={() => setNotesHistoryOpen(false)}>
          <Pressable style={styles.notesModalOverlay} onPress={() => setNotesHistoryOpen(false)}>
            <Pressable style={styles.notesModalSheet} onPress={() => {}}>
              <View style={styles.notesModalHeader}>
                <Text style={styles.notesModalTitle} numberOfLines={1}>
                  {exercise.name.replace(/\b\w/g, (c) => c.toUpperCase())} · Notes
                </Text>
                <TouchableOpacity
                  onPress={() => setNotesHistoryOpen(false)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={ms(20)} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.notesModalScroll}
                contentContainerStyle={styles.notesModalContent}
                showsVerticalScrollIndicator
              >
                {prevNotes.map((n, i) => {
                  const c = noteColorValue(n.color);
                  return (
                    <View
                      key={`histnote-${i}`}
                      style={[
                        styles.notesModalItem,
                        i > 0 && styles.notesPrevItemDivider,
                        c && { borderLeftWidth: sw(3), borderLeftColor: c, paddingLeft: sw(10) },
                      ]}
                    >
                      <Text style={[styles.notesPrevDate, c && { color: c }]}>{formatNoteDate(n.date)}</Text>
                      <Text style={styles.notesModalText}>{n.note}</Text>
                    </View>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

export default React.memo(ExerciseNotes);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  notesAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    marginTop: sw(8),
  },
  notesAddText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
  },
  notesWrap: {
    marginTop: sw(8),
  },
  notesInput: {
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.regular,
    lineHeight: ms(16),
    minHeight: sw(34),
  },
  notesEditFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sw(6),
  },
  notesSwatches: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  swatch: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(11),
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: sw(2),
    borderColor: colors.textPrimary,
  },
  notesEditActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  notesDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    paddingVertical: sw(5),
    paddingHorizontal: sw(10),
    borderRadius: sw(6),
    backgroundColor: colors.accentRed + '15',
  },
  notesDeleteText: {
    color: colors.accentRed,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
  notesSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(3),
    paddingVertical: sw(5),
    paddingHorizontal: sw(12),
    borderRadius: sw(6),
    backgroundColor: colors.accent + '15',
  },
  notesSaveText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
  notesDisplay: {
    marginTop: sw(8),
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
  },
  notesDisplayText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.regular,
    lineHeight: ms(16),
  },
  notesPrevWrap: {
    marginTop: sw(8),
    borderRadius: sw(6),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  notesPrevItem: {
    paddingVertical: sw(6),
    paddingHorizontal: sw(10),
  },
  notesPrevItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  notesPrevToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(3),
    paddingVertical: sw(7),
    paddingHorizontal: sw(10),
  },
  notesPrevToggleText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(14),
  },
  notesModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  notesModalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: sw(16),
    borderTopRightRadius: sw(16),
    maxHeight: '70%',
    paddingBottom: sw(24),
  },
  notesModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingTop: sw(16),
    paddingBottom: sw(12),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  notesModalTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    marginRight: sw(12),
  },
  notesModalScroll: {
    flexGrow: 0,
  },
  notesModalContent: {
    paddingHorizontal: sw(16),
    paddingTop: sw(4),
  },
  notesModalItem: {
    paddingVertical: sw(12),
  },
  notesModalText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.regular,
    lineHeight: ms(18),
    marginTop: sw(2),
  },
  notesPrevText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.regular,
    lineHeight: ms(15),
  },
  notesPrevDate: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: sw(2),
  },
});
