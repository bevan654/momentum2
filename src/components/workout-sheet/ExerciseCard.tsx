import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import type { ActiveExercise } from '../../stores/useActiveWorkoutStore';
import SetRow from './SetRow';

interface Props {
  exercise: ActiveExercise;
  exerciseIndex: number;
  isLast: boolean;
  totalExercises: number;
  onReplace: (exerciseIndex: number) => void;
  onInputFocus?: (y: number) => void;
}

function ExerciseCard({ exercise, exerciseIndex, isLast, totalExercises, onReplace, onInputFocus }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const addSet = useActiveWorkoutStore((s) => s.addSet);
  const removeExercise = useActiveWorkoutStore((s) => s.removeExercise);
  const removeSet = useActiveWorkoutStore((s) => s.removeSet);
  const updateSet = useActiveWorkoutStore((s) => s.updateSet);
  const toggleSetComplete = useActiveWorkoutStore((s) => s.toggleSetComplete);
  const cycleSetType = useActiveWorkoutStore((s) => s.cycleSetType);
  const moveExercise = useActiveWorkoutStore((s) => s.moveExercise);

  return (
    <View style={styles.card}>
      {/* Header: title + action icons */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{exercise.name}</Text>

        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => moveExercise(exerciseIndex, 'up')}
            disabled={exerciseIndex === 0}
            style={styles.actionBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="chevron-up" size={ms(14)} color={exerciseIndex === 0 ? colors.textTertiary + '40' : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => moveExercise(exerciseIndex, 'down')}
            disabled={isLast}
            style={styles.actionBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="chevron-down" size={ms(14)} color={isLast ? colors.textTertiary + '40' : colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onReplace(exerciseIndex)}
            style={styles.actionBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="swap-horizontal-outline" size={ms(14)} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => removeExercise(exerciseIndex)}
            style={styles.actionBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Ionicons name="trash-outline" size={ms(13)} color={colors.accentRed} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Column headers */}
      <View style={styles.colHeaders}>
        <Text style={[styles.colHeader, { width: sw(28) }]}>SET</Text>
        <Text style={[styles.colHeader, { width: sw(46) }]}>PREV</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>KG</Text>
        <Text style={[styles.colHeader, { flex: 1 }]}>REPS</Text>
        <View style={{ width: sw(30) }} />
      </View>

      {/* Sets */}
      {exercise.sets.map((set, setIdx) => (
        <SetRow
          key={setIdx}
          index={setIdx}
          set={set}
          prevSet={exercise.prevSets?.[setIdx] || null}
          onUpdate={(field, value) => updateSet(exerciseIndex, setIdx, field, value)}
          onToggle={() => toggleSetComplete(exerciseIndex, setIdx)}
          onCycleSetType={() => cycleSetType(exerciseIndex, setIdx)}
          onDelete={exercise.sets.length > 1 ? () => removeSet(exerciseIndex, setIdx) : null}
          onInputFocus={onInputFocus}
        />
      ))}

      {/* Add Set button */}
      <TouchableOpacity
        style={styles.addSetBtn}
        onPress={() => addSet(exerciseIndex)}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={ms(14)} color={colors.accent} />
        <Text style={styles.addSetText}>Add Set</Text>
      </TouchableOpacity>

    </View>
  );
}

export default React.memo(ExerciseCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(12),
    padding: sw(10),
    marginBottom: sw(8),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sw(6),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
    flexShrink: 1,
    flex: 1,
    marginRight: sw(8),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(2),
  },
  actionBtn: {
    width: sw(26),
    height: sw(26),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: sw(6),
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(4),
    marginBottom: sw(1),
    gap: sw(6),
  },
  colHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    lineHeight: ms(12),
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(7),
    marginTop: sw(3),
    gap: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
  },
  addSetText: {
    color: colors.accent,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(16),
  },

});
