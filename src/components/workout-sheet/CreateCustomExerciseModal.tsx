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
import { MUSCLE_GROUP_COLORS } from '../../constants/muscleGroups';
import BottomSheet from './BottomSheet';

const CATEGORIES = Object.keys(MUSCLE_GROUP_COLORS).filter((k) => k !== 'Custom');

const EXERCISE_TYPES = [
  { key: 'weighted', label: 'Weighted', icon: 'barbell-outline' as const },
  { key: 'bodyweight', label: 'Body', icon: 'body-outline' as const },
  { key: 'duration', label: 'Duration', icon: 'timer-outline' as const },
  { key: 'weighted+bodyweight', label: 'Weighted+BW', icon: 'fitness-outline' as const },
];

const MUSCLES = [
  'Chest', 'Lats', 'Upper Back', 'Traps', 'Front Delts', 'Side Delts',
  'Rear Delts', 'Biceps', 'Triceps', 'Forearms', 'Quads', 'Hamstrings',
  'Glutes', 'Calves', 'Abs', 'Obliques', 'Lower Back',
] as const;

const EQUIPMENT = [
  'Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight',
  'Band', 'Kettlebell', 'Smith Machine', 'EZ Bar', 'Plate',
] as const;

/* ── Form state (single dispatch = single re-render) ── */

interface FormState {
  name: string;
  category: string;
  exerciseType: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string[];
  musclesExpanded: boolean;
  equipmentExpanded: boolean;
}

type FormAction =
  | { type: 'RESET'; name: string }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_CATEGORY'; value: string }
  | { type: 'SET_TYPE'; value: string }
  | { type: 'TOGGLE_PRIMARY'; value: string }
  | { type: 'TOGGLE_SECONDARY'; value: string }
  | { type: 'TOGGLE_EQUIPMENT'; value: string }
  | { type: 'TOGGLE_MUSCLES_EXPANDED' }
  | { type: 'TOGGLE_EQUIPMENT_EXPANDED' };

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
        musclesExpanded: false,
        equipmentExpanded: false,
      };
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'SET_CATEGORY':
      return { ...state, category: action.value };
    case 'SET_TYPE':
      return { ...state, exerciseType: action.value };
    case 'TOGGLE_PRIMARY':
      return { ...state, primaryMuscles: toggleInList(state.primaryMuscles, action.value) };
    case 'TOGGLE_SECONDARY':
      return { ...state, secondaryMuscles: toggleInList(state.secondaryMuscles, action.value) };
    case 'TOGGLE_EQUIPMENT':
      return { ...state, equipment: toggleInList(state.equipment, action.value) };
    case 'TOGGLE_MUSCLES_EXPANDED':
      return { ...state, musclesExpanded: !state.musclesExpanded };
    case 'TOGGLE_EQUIPMENT_EXPANDED':
      return { ...state, equipmentExpanded: !state.equipmentExpanded };
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
    musclesExpanded: false,
    equipmentExpanded: false,
  });

  // Single dispatch resets all fields in one re-render
  React.useEffect(() => {
    if (visible) dispatch({ type: 'RESET', name: initialName });
  }, [visible, initialName]);

  const {
    name, category, exerciseType, primaryMuscles, secondaryMuscles,
    equipment, musclesExpanded, equipmentExpanded,
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

  const selectedMuscleCount = primaryMuscles.length + secondaryMuscles.length;
  const selectedEquipmentCount = equipment.length;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="85%"
      modal
      bgColor={colors.background}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>New Exercise</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
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
            <View style={styles.inputRow}>
              <Ionicons name="create-outline" size={ms(18)} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(v) => dispatch({ type: 'SET_NAME', value: v })}
                placeholder="Exercise name"
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

          {/* ── Category ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const color = MUSCLE_GROUP_COLORS[cat];
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
                    <View style={[styles.categoryDot, { backgroundColor: color }]} />
                    <Text
                      style={[
                        styles.categoryChipText,
                        active && { color },
                      ]}
                    >
                      {cat}
                    </Text>
                    {active && (
                      <Ionicons name="checkmark" size={ms(14)} color={color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* ── Exercise Type ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Type</Text>
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
                      size={ms(20)}
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

          {/* ── Muscles (collapsible) ── */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => dispatch({ type: 'TOGGLE_MUSCLES_EXPANDED' })}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleLeft}>
                <Text style={styles.sectionLabel}>Muscles</Text>
                {selectedMuscleCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{selectedMuscleCount}</Text>
                  </View>
                )}
              </View>
              <Ionicons
                name={musclesExpanded ? 'chevron-up' : 'chevron-down'}
                size={ms(18)}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            {musclesExpanded && (
              <View style={styles.collapsibleBody}>
                <Text style={styles.subLabel}>Primary</Text>
                <View style={styles.chipRow}>
                  {MUSCLES.map((m) => {
                    const active = primaryMuscles.includes(m);
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => dispatch({ type: 'TOGGLE_PRIMARY', value: m })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={[styles.subLabel, { marginTop: sw(14) }]}>Secondary</Text>
                <View style={styles.chipRow}>
                  {MUSCLES.map((m) => {
                    const active = secondaryMuscles.includes(m);
                    return (
                      <TouchableOpacity
                        key={m}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => dispatch({ type: 'TOGGLE_SECONDARY', value: m })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* ── Equipment (collapsible) ── */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.collapsibleHeader}
              onPress={() => dispatch({ type: 'TOGGLE_EQUIPMENT_EXPANDED' })}
              activeOpacity={0.7}
            >
              <View style={styles.collapsibleLeft}>
                <Text style={styles.sectionLabel}>Equipment</Text>
                {selectedEquipmentCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{selectedEquipmentCount}</Text>
                  </View>
                )}
              </View>
              <Ionicons
                name={equipmentExpanded ? 'chevron-up' : 'chevron-down'}
                size={ms(18)}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            {equipmentExpanded && (
              <View style={styles.collapsibleBody}>
                <View style={styles.chipRow}>
                  {EQUIPMENT.map((e) => {
                    const active = equipment.includes(e);
                    return (
                      <TouchableOpacity
                        key={e}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => dispatch({ type: 'TOGGLE_EQUIPMENT', value: e })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {e}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
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
            <Ionicons name="add" size={ms(20)} color={canSubmit ? colors.textOnAccent : colors.textTertiary} />
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
      paddingBottom: sw(16),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(20),
      fontFamily: Fonts.bold,
      lineHeight: ms(25),
    },
    closeBtn: {
      width: sw(32),
      height: sw(32),
      borderRadius: sw(16),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
    },
    bodyContent: {
      paddingHorizontal: sw(16),
      paddingBottom: sw(20),
      gap: sw(12),
    },

    /* ── Sections ── */
    section: {
      backgroundColor: colors.surface,
      borderRadius: sw(14),
      padding: sw(14),
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(16),
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    /* ── Name Input ── */
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
    },
    inputIcon: {
      marginTop: sw(1),
    },
    textInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(16),
      fontFamily: Fonts.medium,
      lineHeight: ms(22),
      paddingVertical: sw(4),
    },

    /* ── Category ── */
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(8),
      marginTop: sw(10),
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      paddingHorizontal: sw(12),
      paddingVertical: sw(8),
      borderRadius: sw(10),
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      backgroundColor: colors.background,
    },
    categoryDot: {
      width: sw(8),
      height: sw(8),
      borderRadius: sw(4),
    },
    categoryChipText: {
      color: colors.textSecondary,
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
    },

    /* ── Type selector ── */
    typeRow: {
      flexDirection: 'row',
      gap: sw(8),
      marginTop: sw(10),
    },
    typeCard: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: sw(12),
      borderRadius: sw(10),
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      gap: sw(4),
    },
    typeCardActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '15',
    },
    typeLabel: {
      color: colors.textTertiary,
      fontSize: ms(10),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(14),
    },
    typeLabelActive: {
      color: colors.accent,
    },

    /* ── Collapsible ── */
    collapsibleHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    collapsibleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    countBadge: {
      backgroundColor: colors.accent,
      borderRadius: sw(10),
      minWidth: sw(20),
      height: sw(20),
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sw(6),
    },
    countBadgeText: {
      color: colors.textOnAccent,
      fontSize: ms(11),
      fontFamily: Fonts.bold,
      lineHeight: ms(14),
    },
    collapsibleBody: {
      marginTop: sw(12),
    },
    subLabel: {
      color: colors.textTertiary,
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(15),
      marginBottom: sw(8),
    },

    /* ── Chips ── */
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: sw(6),
    },
    chip: {
      paddingHorizontal: sw(10),
      paddingVertical: sw(6),
      borderRadius: sw(8),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.background,
    },
    chipActive: {
      backgroundColor: colors.accent + '20',
      borderColor: colors.accent,
    },
    chipText: {
      color: colors.textSecondary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(16),
    },
    chipTextActive: {
      color: colors.accent,
    },

    /* ── Bottom Bar ── */
    bottomBar: {
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
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
      paddingVertical: sw(14),
      borderRadius: sw(14),
    },
    createButtonDisabled: {
      backgroundColor: colors.surface,
    },
    createButtonText: {
      color: colors.textOnAccent,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
    },
    createButtonTextDisabled: {
      color: colors.textTertiary,
    },
  });
