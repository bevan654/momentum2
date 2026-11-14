import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { getUICategoryColor } from '../../../constants/muscles';
import { isTimedType, showsKg, type EditExercise } from './summaryFormat';

function EditableExerciseSection({
  exercise,
  exIdx,
  canRemove,
  colors,
  onUpdateSet,
  onRemoveSet,
  onAddSet,
  onRemoveExercise,
}: {
  exercise: EditExercise;
  exIdx: number;
  canRemove: boolean;
  colors: ThemeColors;
  onUpdateSet: (exIdx: number, setIdx: number, field: 'kg' | 'reps', value: string) => void;
  onRemoveSet: (exIdx: number, setIdx: number) => void;
  onAddSet: (exIdx: number) => void;
  onRemoveExercise: (exIdx: number) => void;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const catColor = exercise.category ? getUICategoryColor(exercise.category) : colors.textTertiary;

  const SET_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
    warmup: { label: 'W', color: colors.accentOrange },
    drop: { label: 'D', color: colors.accentBabyBlue },
    failure: { label: 'F', color: colors.accentRed },
  };

  return (
    <View style={styles.exerciseDetail}>
      <View style={styles.exerciseHeader}>
        <View style={[styles.catStrip, { backgroundColor: catColor }]} />
        <Text style={styles.exerciseDetailName} numberOfLines={1}>{exercise.name}</Text>
        <View style={{ flex: 1 }} />
        {canRemove && (
          <TouchableOpacity style={styles.removeExerciseBtn} onPress={() => onRemoveExercise(exIdx)} activeOpacity={0.6}>
            <Ionicons name="close-circle" size={ms(16)} color={colors.accentRed} />
          </TouchableOpacity>
        )}
      </View>

      {/* Column headers */}
      <View style={styles.setRow}>
        <View style={styles.setNumCol}>
          <Text style={styles.editColHeader}>#</Text>
        </View>
        {showsKg(exercise.exercise_type) && (
          <Text style={[styles.editColHeader, { flex: 1, textAlign: 'center' }]}>
            {exercise.exercise_type === 'weighted+bodyweight' ? '+kg' : 'kg'}
          </Text>
        )}
        {showsKg(exercise.exercise_type) && <View style={{ width: sw(14) }} />}
        <Text style={[styles.editColHeader, { flex: 1, textAlign: 'center' }]}>
          {isTimedType(exercise.exercise_type) ? 'secs' : 'reps'}
        </Text>
        <View style={styles.setStatusCol} />
      </View>

      {exercise.sets.map((s, i) => {
        const typeConfig = SET_TYPE_CONFIG[s.set_type || ''];
        return (
          <View key={i} style={styles.setRow}>
            <View style={styles.setNumCol}>
              {typeConfig ? (
                <Text style={[styles.setTypeLabel, { color: typeConfig.color }]}>{typeConfig.label}</Text>
              ) : (
                <Text style={styles.setNumber}>{i + 1}</Text>
              )}
            </View>
            {showsKg(exercise.exercise_type) && (
              <TextInput
                style={styles.editInput}
                value={s.kg}
                onChangeText={(v) => onUpdateSet(exIdx, i, 'kg', v)}
                keyboardType="decimal-pad"
                maxLength={6}
                selectTextOnFocus
                placeholderTextColor={colors.textTertiary}
                placeholder="0"
              />
            )}
            {showsKg(exercise.exercise_type) && <Text style={styles.setTimes}>&times;</Text>}
            <TextInput
              style={styles.editInput}
              value={s.reps}
              onChangeText={(v) => onUpdateSet(exIdx, i, 'reps', v)}
              keyboardType="number-pad"
              maxLength={isTimedType(exercise.exercise_type) ? 5 : 4}
              selectTextOnFocus
              placeholderTextColor={colors.textTertiary}
              placeholder="0"
            />
            <View style={styles.setStatusCol}>
              {exercise.sets.length > 1 ? (
                <TouchableOpacity onPress={() => onRemoveSet(exIdx, i)} activeOpacity={0.6}>
                  <Ionicons name="close" size={ms(12)} color={colors.accentRed + '90'} />
                </TouchableOpacity>
              ) : (
                <View style={styles.incompleteDot} />
              )}
            </View>
          </View>
        );
      })}

      <TouchableOpacity style={styles.addSetBtn} onPress={() => onAddSet(exIdx)} activeOpacity={0.7}>
        <Ionicons name="add" size={ms(12)} color={colors.accent} />
        <Text style={styles.addSetBtnText}>Add Set</Text>
      </TouchableOpacity>
    </View>
  );
}

export default React.memo(EditableExerciseSection);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  exerciseDetail: {
    backgroundColor: colors.surface,
    paddingVertical: sw(8),
    paddingHorizontal: sw(10),
    overflow: 'hidden',
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: sw(4),
  },
  catStrip: {
    width: sw(3),
    height: sw(14),
    marginRight: sw(8),
  },
  exerciseDetailName: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(4),
    paddingHorizontal: sw(4),
    borderRadius: sw(4),
  },
  setNumCol: {
    width: sw(22),
    alignItems: 'center',
  },
  setNumber: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.bold,
    lineHeight: ms(15),
  },
  setTypeLabel: {
    fontSize: ms(11),
    fontFamily: Fonts.extraBold,
    lineHeight: ms(15),
  },
  setTimes: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    lineHeight: ms(14),
    marginHorizontal: sw(2),
  },
  setStatusCol: {
    width: sw(20),
    alignItems: 'center',
  },
  incompleteDot: {
    width: sw(5),
    height: sw(5),
    borderRadius: sw(3),
    backgroundColor: colors.textTertiary + '40',
  },
  editInput: {
    flex: 1,
    backgroundColor: colors.card,
    color: colors.textPrimary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
    textAlign: 'center',
    paddingVertical: sw(4),
    paddingHorizontal: sw(6),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: sw(28),
  },
  editColHeader: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(13),
  },
  removeExerciseBtn: {
    padding: sw(4),
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(4),
    paddingVertical: sw(6),
    marginTop: sw(4),
    borderRadius: sw(6),
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderStyle: 'dashed',
  },
  addSetBtnText: {
    color: colors.accent,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(15),
  },
});
