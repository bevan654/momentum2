import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useThemeStore } from '../../stores/useThemeStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import Body, { type ExtendedBodyPart } from '../BodyHighlighter';
import { toSlug, ALL_SLUGS } from '../../utils/muscleVolume';
import MusclePill from './MusclePill';

interface LocalSet {
  goal_reps: number;
  goal_weight: number;
}

/* ─── Focused body map helpers ─────────────────────────── */

const CATEGORY_SLUGS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids', 'rear-deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors'],
  Core: ['abs', 'obliques'],
};

/** Focus Y position (0-1 fraction of body height) per slug */
const SLUG_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  chest:          { y: 0.32, side: 'front' },
  deltoids:       { y: 0.26, side: 'front' },
  'rear-deltoids':{ y: 0.26, side: 'back' },
  biceps:         { y: 0.37, side: 'front' },
  triceps:        { y: 0.37, side: 'back' },
  forearm:        { y: 0.48, side: 'front' },
  abs:            { y: 0.44, side: 'front' },
  obliques:       { y: 0.44, side: 'front' },
  'upper-back':   { y: 0.32, side: 'back' },
  'lower-back':   { y: 0.44, side: 'back' },
  trapezius:      { y: 0.23, side: 'back' },
  quadriceps:     { y: 0.66, side: 'front' },
  hamstring:      { y: 0.66, side: 'back' },
  gluteal:        { y: 0.53, side: 'back' },
  calves:         { y: 0.83, side: 'back' },
  adductors:      { y: 0.62, side: 'front' },
  tibialis:       { y: 0.80, side: 'front' },
};

const CATEGORY_FOCUS: Record<string, { y: number; side: 'front' | 'back' }> = {
  Chest:     { y: 0.32, side: 'front' },
  Back:      { y: 0.32, side: 'back' },
  Shoulders: { y: 0.26, side: 'front' },
  Arms:      { y: 0.37, side: 'front' },
  Legs:      { y: 0.66, side: 'front' },
  Core:      { y: 0.44, side: 'front' },
};

const BODY_SCALE = 0.35;
const BODY_W = 200 * BODY_SCALE;
const BODY_H = 400 * BODY_SCALE;

interface ExerciseCardProps {
  name: string;
  sets: LocalSet[];
  restSeconds: number;
  category: string | null;
  prevSets: { kg: number; reps: number }[];
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onSetRepsChange: (setIndex: number, reps: number) => void;
  onSetWeightChange: (setIndex: number, weight: number) => void;
  onRestChange: (seconds: number) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst: boolean;
  isLast: boolean;
}

const REST_OPTIONS = [30, 45, 60, 90, 120, 150, 180, 240, 300];

/* ─── Editable cell that allows empty while typing ──── */
function CellInput({
  value,
  onCommit,
  parseValue,
  style,
  ...rest
}: {
  value: string;
  onCommit: (n: number) => void;
  parseValue: (text: string) => number;
  style: any;
} & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'onBlur'>) {
  const [localValue, setLocalValue] = useState<string | null>(null);
  const editing = localValue !== null;

  return (
    <TextInput
      style={style}
      value={editing ? localValue : value}
      onFocus={() => setLocalValue(value)}
      onChangeText={setLocalValue}
      onBlur={() => {
        const n = parseValue(localValue ?? value);
        onCommit(n);
        setLocalValue(null);
      }}
      selectTextOnFocus
      {...rest}
    />
  );
}

function ExerciseCard({
  name,
  sets,
  restSeconds,
  category,
  prevSets,
  onAddSet,
  onRemoveSet,
  onSetRepsChange,
  onSetWeightChange,
  onRestChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: ExerciseCardProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showRestPicker, setShowRestPicker] = useState(false);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const themeMode = useThemeStore((s) => s.mode);

  // Build body highlight data + focus region
  const { bodyData, focusY, bodySide, hasMuscles } = useMemo(() => {
    const entry = catalogMap[name];
    const primarySlugs = new Set<string>();
    const secondarySlugs = new Set<string>();

    if (entry) {
      for (const m of entry.primary_muscles) {
        const s = toSlug(m);
        if (s) primarySlugs.add(s);
      }
      for (const m of entry.secondary_muscles) {
        const s = toSlug(m);
        if (s) secondarySlugs.add(s);
      }
    }

    if (primarySlugs.size === 0 && category) {
      const slugs = CATEGORY_SLUGS[category];
      if (slugs) slugs.forEach((s) => primarySlugs.add(s));
    }

    // Determine focus from first primary slug, fallback to category
    const firstSlug = [...primarySlugs][0];
    let focusY = 0.35;
    let bodySide: 'front' | 'back' = 'front';

    if (firstSlug && SLUG_FOCUS[firstSlug]) {
      focusY = SLUG_FOCUS[firstSlug].y;
      bodySide = SLUG_FOCUS[firstSlug].side;
    } else if (category && CATEGORY_FOCUS[category]) {
      focusY = CATEGORY_FOCUS[category].y;
      bodySide = CATEGORY_FOCUS[category].side;
    }

    const bodyData: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => ({
      slug,
      intensity: primarySlugs.has(slug) ? 6 : secondarySlugs.has(slug) ? 3 : 1,
    }));

    return { bodyData, focusY, bodySide, hasMuscles: primarySlugs.size > 0 };
  }, [name, category, catalogMap]);

  // Accent-tinted palette for the body map
  const bodyPalette = useMemo(() => {
    const a = colors.accent;
    if (themeMode === 'dark') {
      return ['#1A1A1E', '#2A2A2E', a + '40', a + '60', a + '80', a, a];
    }
    return ['#E8E4DE', '#C8C4BE', a + '40', a + '60', a + '80', a, a];
  }, [themeMode, colors.accent]);

  // Body map crop offsets
  const MAP_W = sw(44);
  const MAP_H = sw(52);
  const bodyOffsetX = -(BODY_W - MAP_W) / 2;
  const bodyOffsetY = -(BODY_H * focusY) + MAP_H / 2;

  const repRange = useMemo(() => {
    if (sets.length === 0) return '0';
    const reps = sets.map((s) => s.goal_reps);
    const min = Math.min(...reps);
    const max = Math.max(...reps);
    return min === max ? `${min}` : `${min}-${max}`;
  }, [sets]);

  const formatRest = useCallback((s: number) => {
    if (s >= 60) {
      const m = Math.floor(s / 60);
      const rem = s % 60;
      return rem > 0 ? `${m}m${rem}s` : `${m}m`;
    }
    return `${s}s`;
  }, []);

  const summary = `${sets.length} sets · ${repRange} reps`;

  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = useCallback(() => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        onRemove();
      }}
      activeOpacity={0.7}
    >
      <Ionicons name="trash" size={ms(22)} color="#fff" />
      <Text style={styles.deleteText}>Delete</Text>
    </TouchableOpacity>
  ), [onRemove, styles]);

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
    <View style={styles.card}>
      {/* Header section */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name} numberOfLines={1}>
            {name.replace(/\b\w/g, (c) => c.toUpperCase())}
          </Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summary}>{summary}</Text>
            <TouchableOpacity
              onPress={() => setShowRestPicker(true)}
              style={styles.restChip}
              activeOpacity={0.6}
            >
              <Ionicons name="timer-outline" size={ms(12)} color={colors.accent} />
              <Text style={styles.restChipText}>{formatRest(restSeconds)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mini body map — focused on target muscles */}
        {hasMuscles && (
          <View style={[styles.bodyMapClip, { width: MAP_W, height: MAP_H }]}>
            <View style={{ position: 'absolute', left: bodyOffsetX, top: bodyOffsetY }}>
              <Body
                data={bodyData}
                side={bodySide}
                gender="male"
                scale={BODY_SCALE}
                colors={bodyPalette}
                border="none"
                backColor={colors.cardBorder}
              />
            </View>
          </View>
        )}

      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Set rows section */}
      <View style={styles.setsSection}>
        {/* Column headers */}
        <View style={styles.setHeaderRow}>
          <Text style={[styles.colHeader, styles.colSet]}>SET</Text>
          <Text style={[styles.colHeader, styles.colPrev]}>PREV</Text>
          <Text style={[styles.colHeader, styles.colWeight]}>KG</Text>
          <Text style={[styles.colHeader, styles.colReps]}>REPS</Text>
          <View style={styles.colAction} />
        </View>

        {/* Individual set rows */}
        {sets.map((setItem, setIndex) => {
          const prev = prevSets[setIndex];
          const prevText = prev ? `${prev.kg}×${prev.reps}` : '—';

          return (
            <View key={setIndex} style={styles.setRow}>
              <Text style={[styles.setNumber, styles.colSet]}>{setIndex + 1}</Text>
              <Text style={[styles.prevText, styles.colPrev]}>{prevText}</Text>
              <View style={[styles.colWeight, styles.inputContainer]}>
                <CellInput
                  value={setItem.goal_weight > 0 ? String(setItem.goal_weight) : ''}
                  onCommit={(n) => onSetWeightChange(setIndex, n)}
                  placeholder="—"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="decimal-pad"
                  style={styles.cellInput}
                  maxLength={5}
                  parseValue={(t) => { const n = parseFloat(t); return isNaN(n) ? 0 : n; }}
                />
              </View>
              <View style={[styles.colReps, styles.inputContainer]}>
                <CellInput
                  value={String(setItem.goal_reps)}
                  onCommit={(n) => onSetRepsChange(setIndex, n)}
                  keyboardType="number-pad"
                  style={styles.cellInput}
                  maxLength={3}
                  parseValue={(t) => { const n = parseInt(t, 10); return isNaN(n) || n < 1 ? 1 : n; }}
                />
              </View>
              <View style={styles.colAction}>
                {sets.length > 1 && (
                  <TouchableOpacity onPress={() => onRemoveSet(setIndex)} style={styles.removeSetBtn}>
                    <Ionicons name="close" size={ms(14)} color={colors.accentRed + '80'} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}

        {/* Add Set button */}
        <TouchableOpacity onPress={onAddSet} style={styles.addSetBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={ms(14)} color={colors.accent} />
          <Text style={styles.addSetText}>Add Set</Text>
        </TouchableOpacity>
      </View>

      {/* Rest Picker Modal */}
      <Modal
        visible={showRestPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRestPicker(false)}
        >
          <View style={styles.restPickerContainer}>
            <Text style={styles.restPickerTitle}>Rest Time</Text>
            <View style={styles.restGrid}>
              {REST_OPTIONS.map((sec) => (
                <TouchableOpacity
                  key={sec}
                  style={[
                    styles.restOption,
                    sec === restSeconds && { backgroundColor: colors.accent },
                  ]}
                  onPress={() => {
                    onRestChange(sec);
                    setShowRestPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.restOptionText,
                      sec === restSeconds && { color: colors.textOnAccent },
                    ]}
                  >
                    {formatRest(sec)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
    </Swipeable>
  );
}

export default React.memo(ExerciseCard);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 0,
      padding: sw(12),
      overflow: 'hidden',
      borderWidth: sw(2),
      borderColor: colors.cardBorder,
    },
    deleteAction: {
      backgroundColor: colors.accentRed,
      justifyContent: 'center',
      alignItems: 'center',
      width: sw(80),
      gap: sw(4),
    },
    deleteText: {
      color: '#fff',
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
    },

    // Header
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerLeft: {
      flex: 1,
      gap: sw(4),
      marginRight: sw(10),
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    name: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
      lineHeight: ms(18),
      flexShrink: 1,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    summary: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
    },
    restChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(3),
      backgroundColor: colors.accent + '18',
      paddingHorizontal: sw(8),
      paddingVertical: sw(3),
      borderRadius: sw(10),
    },
    restChipText: {
      color: colors.accent,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(14),
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
    },
    reorderCol: {
      gap: sw(0),
    },
    reorderBtn: {
      padding: sw(2),
    },
    bodyMapClip: {
      overflow: 'hidden',
      borderRadius: sw(8),
      opacity: 0.85,
    },
    removeBtn: {
      padding: sw(4),
    },

    // Divider
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
      marginVertical: sw(10),
    },

    // Sets section
    setsSection: {
      gap: sw(4),
    },
    setHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(4),
    },
    colHeader: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(14),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    colSet: {
      width: sw(36),
      textAlign: 'center',
    },
    colPrev: {
      width: sw(72),
      textAlign: 'center',
    },
    colWeight: {
      flex: 1,
      textAlign: 'center',
    },
    colReps: {
      flex: 1,
      textAlign: 'center',
    },
    colAction: {
      width: sw(30),
      alignItems: 'center',
    },

    // Set row
    setRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: sw(6),
      paddingHorizontal: sw(2),
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.cardBorder,
    },
    setNumber: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(14),
    },
    prevText: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(14),
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellInput: {
      color: colors.textPrimary,
      fontSize: ms(13),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      textAlignVertical: 'center',
      minWidth: sw(36),
      height: sw(28),
      paddingVertical: 0,
      paddingHorizontal: sw(4),
      backgroundColor: colors.card,
      borderRadius: sw(6),
    },
    removeSetBtn: {
      padding: sw(4),
    },

    // Add Set
    addSetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(4),
      paddingVertical: sw(8),
      marginTop: sw(2),
    },
    addSetText: {
      color: colors.accent,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(14),
    },

    // Rest Picker Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    restPickerContainer: {
      backgroundColor: colors.card,
      borderRadius: sw(16),
      padding: sw(20),
      width: '80%',
      maxWidth: sw(320),
    },
    restPickerTitle: {
      color: colors.textPrimary,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
      textAlign: 'center',
      marginBottom: sw(16),
    },
    restGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(8),
      justifyContent: 'center',
    },
    restOption: {
      backgroundColor: colors.surface,
      borderRadius: sw(10),
      paddingVertical: sw(12),
      paddingHorizontal: sw(16),
      minWidth: '28%',
      alignItems: 'center',
    },
    restOptionText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(20),
    },
  });
