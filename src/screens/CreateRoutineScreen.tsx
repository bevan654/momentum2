import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import ExerciseRow from '../components/workouts/ExerciseRow';
import ExercisePicker from '../components/workout-sheet/ExercisePicker';

interface LocalExercise {
  name: string;
  default_sets: number;
  category: string | null;
  exercise_type: string;
}

export default function CreateRoutineScreen() {
  const navigation = useNavigation();
  const userId = useAuthStore((s) => s.user?.id);
  const createRoutine = useRoutineStore((s) => s.createRoutine);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [routineName, setRoutineName] = useState('');
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddExercise = useCallback((name: string, exerciseType: string, category: string | null) => {
    setExercises((prev) => [...prev, { name, default_sets: 3, category, exercise_type: exerciseType }]);
  }, []);

  const handleSetsChange = useCallback((index: number, delta: number) => {
    setExercises((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], default_sets: Math.max(1, next[index].default_sets + delta) };
      return next;
    });
  }, []);

  const handleRemove = useCallback((index: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setExercises((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setExercises((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!routineName.trim()) {
      Alert.alert('Error', 'Enter a routine name');
      return;
    }
    if (!userId) return;

    setSaving(true);
    const routineExercises = exercises.map((e, i) => ({
      name: e.name,
      exercise_order: i + 1,
      default_sets: e.default_sets,
      exercise_type: e.exercise_type || 'weighted',
    }));

    const { error } = await createRoutine(userId, routineName.trim(), routineExercises);
    setSaving(false);

    if (error) {
      Alert.alert('Error', error);
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Routine</Text>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Routine Name */}
          <Text style={styles.label}>Routine Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Push Day, Upper Body"
            placeholderTextColor={colors.textTertiary}
            value={routineName}
            onChangeText={setRoutineName}
          />

          {/* Exercises */}
          <View style={styles.exercisesHeader}>
            <Text style={styles.label}>Exercises</Text>
            <TouchableOpacity
              style={styles.addExBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={ms(16)} color={colors.accent} />
              <Text style={styles.addExText}>Add Exercise</Text>
            </TouchableOpacity>
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Text style={styles.emptyText}>No exercises added</Text>
            </View>
          ) : (
            <View style={styles.exerciseList}>
              {exercises.map((ex, i) => (
                <ExerciseRow
                  key={`${ex.name}-${i}`}
                  name={ex.name}
                  sets={ex.default_sets}
                  category={ex.category}
                  onSetsChange={(delta) => handleSetsChange(i, delta)}
                  onRemove={() => handleRemove(i)}
                  onMoveUp={() => handleMoveUp(i)}
                  onMoveDown={() => handleMoveDown(i)}
                  isFirst={i === 0}
                  isLast={i === exercises.length - 1}
                />
              ))}
            </View>
          )}

          {/* Bottom spacing for button */}
          <View style={{ height: sw(80) }} />
        </ScrollView>

        {/* Save button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Routine'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <ExercisePicker
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSelect={handleAddExercise}
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
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
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: sw(16),
  },
  label: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
    marginBottom: sw(8),
    marginTop: sw(16),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: sw(12),
    padding: sw(16),
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.medium,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addExBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    marginTop: sw(16),
  },
  addExText: {
    color: colors.accent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  exerciseList: {
    gap: sw(8),
  },
  emptyExercises: {
    backgroundColor: colors.card,
    borderRadius: sw(12),
    paddingVertical: sw(24),
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: sw(16),
    paddingTop: sw(12),
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.cardBorder,
  },
  saveButton: {
    backgroundColor: colors.accent,
    borderRadius: sw(12),
    paddingVertical: sw(16),
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.textOnAccent,
    fontSize: ms(17),
    lineHeight: ms(23),
    fontFamily: Fonts.bold,
  },
});
