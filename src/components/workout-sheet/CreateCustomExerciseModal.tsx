import React, { useMemo, useReducer, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import {
  UI_CATEGORY_COLORS,
  DISPLAY_MUSCLES,
  CATEGORY_MUSCLES,
  CANONICAL_TO_UI_CATEGORY,
  MUSCLE_COLORS,
  type CanonicalMuscle,
} from '../../constants/muscles';
import BottomSheet from './BottomSheet';

const CATEGORIES = Object.keys(UI_CATEGORY_COLORS).filter((k) => k !== 'Custom' && k !== 'Cardio');

const EXERCISE_TYPES = [
  { key: 'weighted', label: 'Weighted', icon: 'barbell-outline' as const },
  { key: 'bodyweight', label: 'Bodyweight', icon: 'body-outline' as const },
  { key: 'duration', label: 'Duration', icon: 'timer-outline' as const },
  { key: 'weighted+bodyweight', label: 'Weighted+BW', icon: 'fitness-outline' as const },
];

const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight',
  'Band', 'Kettlebell', 'Smith Machine', 'EZ Bar', 'Plate',
] as const;

/* ── Category → suggested primary muscles (canonical) ��─── */

const CATEGORY_SUGGESTED: Record<string, CanonicalMuscle[]> = {
  Chest: CATEGORY_MUSCLES.Chest,
  Back: CATEGORY_MUSCLES.Back,
  Shoulders: CATEGORY_MUSCLES.Shoulders,
  Arms: CATEGORY_MUSCLES.Arms,
  Legs: CATEGORY_MUSCLES.Legs,
  Core: CATEGORY_MUSCLES.Core,
  Cardio: [],
};

/* ── Muscle chip color (from canonical) ──────────────── */

function getMuscleChipColor(canonical: string): string {
  return MUSCLE_COLORS[canonical as CanonicalMuscle] ?? '#6B7280';
}

/* ── Form state (single dispatch = single re-render) ── */

interface FormState {
  name: string;
  category: string;
  exerciseType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
}

type FormAction =
  | { type: 'RESET'; name: string }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'SET_TYPE'; value: string }
  | { type: 'TOGGLE_PRIMARY'; value: string }
  | { type: 'TOGGLE_SECONDARY'; value: string }
  | { type: 'TOGGLE_EQUIPMENT'; value: string };

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'RESET':
      return {
        name: action.name,
        category: '',
        exerciseType: 'weighted',
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
      };
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'SET_CATEGORY': {
      const suggested = CATEGORY_SUGGESTED[action.value] || [];
      return {
        ...state,
        category: action.value,
        // Auto-populate primary muscles, remove them from secondary if overlapping
        primaryMuscles: suggested,
        secondaryMuscles: state.secondaryMuscles.filter((m) => !(suggested as string[]).includes(m)),
      };
    }
    case 'SET_TYPE':
      return { ...state, exerciseType: action.value };
    case 'TOGGLE_PRIMARY': {
      const newPrimary = toggleInList(state.primaryMuscles, action.value);
      // Remove from secondary if now primary
      const newSecondary = newPrimary.includes(action.value)
        ? state.secondaryMuscles.filter((m) => m !== action.value)
        : state.secondaryMuscles;
      return { ...state, primaryMuscles: newPrimary, secondaryMuscles: newSecondary };
    }
    case 'TOGGLE_SECONDARY': {
      const newSecondary = toggleInList(state.secondaryMuscles, action.value);
      // Remove from primary if now secondary
      const newPrimary = newSecondary.includes(action.value)
        ? state.primaryMuscles.filter((m) => m !== action.value)
        : state.primaryMuscles;
      return { ...state, primaryMuscles: newPrimary, secondaryMuscles: newSecondary };
    }
    case 'TOGGLE_EQUIPMENT':
      return { ...state, equipment: toggleInList(state.equipment, action.value) };
    default:
      return state;
  }
}

interface Props {
  visible: boolean;
  initialName: string;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    category: string;
    exerciseType: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
    equipment: string[];
  }) => void;
}

export default function CreateCustomExerciseModal({
  visible,
  initialName,
  onClose,
  onSubmit,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [form, dispatch] = useReducer(formReducer, {
    name: initialName,
    category: '',
    exerciseType: 'weighted',
    primaryMuscles: [],
    secondaryMuscles: [],
    equipment: [],
  });

  React.useEffect(() => {
    if (visible) dispatch({ type: 'RESET', name: initialName });
  }, [visible, initialName]);

  const {
    name, category, exerciseType, primaryMuscles, secondaryMuscles, equipment,
  } = form;

  const canSubmit = name.trim().length > 0 && category.length > 0;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit({
      name: name.trim(),
      category,
      exerciseType,
      primaryMuscles,
      secondaryMuscles,
      equipment,
    });
  }, [canSubmit, name, category, exerciseType, primaryMuscles, secondaryMuscles, equipment, onSubmit]);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="90%"
      modal
      bgColor={colors.background}
      radius={0}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>New Exercise</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={ms(20)} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Name ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NAME</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(v) => dispatch({ type: 'SET_NAME', value: v })}
                placeholder="e.g. Cable Lateral Raise"
                placeholderTextColor={colors.textTertiary}
                autoFocus
              />
              {name.length > 0 && (
                <TouchableOpacity onPress={() => dispatch({ type: 'SET_NAME', value: '' })} hitSlop={8}>
                  <Ionicons name="close-circle" size={ms(16)} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* ── Category (required) ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>MUSCLE GROUP</Text>
            <View style={styles.chipGrid}>
              {CATEGORIES.map((cat) => {
                const color = UI_CATEGORY_COLORS[cat as keyof typeof UI_CATEGORY_COLORS] ?? '#6B7280';
                const active = category === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      active && { backgroundColor: color + '20', borderColor: color },
                    ]}
                    onPress={() => dispatch({ type: 'SET_CATEGORY', value: cat })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.chipDot, { backgroundColor: color }]} />
                    <Text style={[styles.categoryChipText, active && { color }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Exercise Type ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>TYPE</Text>
            <View style={styles.typeRow}>
              {EXERCISE_TYPES.map((t) => {
                const active = exerciseType === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.typeCard, active && styles.typeCardActive]}
                    onPress={() => dispatch({ type: 'SET_TYPE', value: t.key })}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={t.icon}
                      size={ms(18)}
                      color={active ? colors.accent : colors.textTertiary}
                    />
                    <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Primary Muscles ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>PRIMARY MUSCLES</Text>
              {primaryMuscles.length > 0 && (
                <Text style={[styles.countText, { color: colors.accent }]}>{primaryMuscles.length}</Text>
              )}
            </View>
            <View style={styles.chipGrid}>
              {DISPLAY_MUSCLES.map(({ canonical, label }) => {
                const active = primaryMuscles.includes(canonical);
                const mColor = getMuscleChipColor(canonical);
                return (
                  <TouchableOpacity
                    key={canonical}
                    style={[
                      styles.muscleChip,
                      active && { backgroundColor: mColor + '20', borderColor: mColor },
                    ]}
                    onPress={() => dispatch({ type: 'TOGGLE_PRIMARY', value: canonical })}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.chipDot, { backgroundColor: active ? mColor : colors.textTertiary + '40' }]} />
                    <Text style={[styles.muscleChipText, active && { color: mColor }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Secondary Muscles ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>SECONDARY MUSCLES</Text>
              {secondaryMuscles.length > 0 && (
                <Text style={[styles.countText, { color: colors.textTertiary }]}>{secondaryMuscles.length}</Text>
              )}
            </View>
            <View style={styles.chipGrid}>
              {DISPLAY_MUSCLES.map(({ canonical, label }) => {
                const active = secondaryMuscles.includes(canonical);
                const isPrimary = primaryMuscles.includes(canonical);
                const mColor = getMuscleChipColor(canonical);
                return (
                  <TouchableOpacity
                    key={canonical}
                    style={[
                      styles.muscleChip,
                      isPrimary && styles.muscleChipDisabled,
                      active && { backgroundColor: mColor + '15', borderColor: mColor + '80' },
                    ]}
                    onPress={() => { if (!isPrimary) dispatch({ type: 'TOGGLE_SECONDARY', value: canonical }); }}
                    activeOpacity={isPrimary ? 1 : 0.7}
                  >
                    <View style={[styles.chipDot, { backgroundColor: active ? mColor + '80' : isPrimary ? colors.textTertiary + '20' : colors.textTertiary + '40' }]} />
                    <Text style={[
                      styles.muscleChipText,
                      isPrimary && { color: colors.textTertiary + '40' },
                      active && { color: mColor },
                    ]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Equipment ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>EQUIPMENT</Text>
              {equipment.length > 0 && (
                <Text style={[styles.countText, { color: colors.accent }]}>{equipment.length}</Text>
              )}
            </View>
            <View style={styles.chipGrid}>
              {EQUIPMENT.map((e) => {
                const active = equipment.includes(e);
                return (
                  <TouchableOpacity
                    key={e}
                    style={[
                      styles.equipChip,
                      active && styles.equipChipActive,
                    ]}
                    onPress={() => dispatch({ type: 'TOGGLE_EQUIPMENT', value: e })}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.equipChipText, active && styles.equipChipTextActive]}>
                      {e}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* ── Bottom Create Button ── */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.createButton, !canSubmit && styles.createButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            <Text style={[styles.createButtonText, !canSubmit && styles.createButtonTextDisabled]}>
              Create Exercise
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sw(20),
      paddingTop: sw(4),
      paddingBottom: sw(12),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(18),
      fontFamily: Fonts.bold,
      lineHeight: ms(24),
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      paddingHorizontal: sw(16),
      paddingBottom: sw(20),
      gap: sw(16),
    },

    /* ── Sections ── */
    section: {
      gap: sw(10),
    },
    sectionLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.bold,
      lineHeight: ms(14),
      letterSpacing: 1,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },

    /* ── Name Input ── */
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: sw(12),
      gap: sw(8),
    },
    textInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(15),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
      paddingVertical: sw(10),
    },

    /* ── Category chips ── */
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(6),
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      paddingHorizontal: sw(10),
      paddingVertical: sw(6),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    chipDot: {
      width: sw(6),
      height: sw(6),
    },
    categoryChipText: {
      color: colors.textSecondary,
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(16),
    },

    /* ── Type selector ── */
    typeRow: {
      flexDirection: 'row',
      gap: sw(6),
    },
    typeCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: sw(10),
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(3),
    },
    typeCardActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    typeLabel: {
      color: colors.textTertiary,
      fontSize: ms(9),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(13),
    },
    typeLabelActive: {
      color: colors.accent,
    },

    /* ── Muscle chips ── */
    muscleChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(5),
      paddingHorizontal: sw(8),
      paddingVertical: sw(5),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    muscleChipDisabled: {
      opacity: 0.35,
    },
    muscleChipText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(15),
    },

    /* ── Equipment chips ── */
    equipChip: {
      paddingHorizontal: sw(10),
      paddingVertical: sw(6),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    equipChipActive: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent,
    },
    equipChipText: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(15),
    },
    equipChipTextActive: {
      color: colors.accent,
    },

    /* ── Count text ── */
    countText: {
      fontSize: ms(10),
      fontFamily: Fonts.bold,
      lineHeight: ms(14),
    },

    /* ── Bottom Bar ── */
    bottomBar: {
      paddingHorizontal: sw(16),
      paddingTop: sw(10),
      paddingBottom: sw(34),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      backgroundColor: colors.accent,
      paddingVertical: sw(13),
    },
    createButtonDisabled: {
      backgroundColor: colors.surface,
    },
    createButtonText: {
      color: colors.textOnAccent,
      fontSize: ms(15),
      fontFamily: Fonts.bold,
      lineHeight: ms(20),
    },
    createButtonTextDisabled: {
      color: colors.textTertiary,
    },
  });
