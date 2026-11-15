import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useProgramStore, startDayEdit, consumeDayEditResult, type ProgramDay, type ProgramDayExercise } from '../stores/useProgramStore';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import { CalendarPicker } from '../components/workouts/create-program/CalendarPicker';
import { WEEKDAY_SHORT, WEEKDAY_LONG, MONTH_SHORT } from '../constants/dateNames';

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'CreateProgram'>;

/* ─── Main screen ───────────────────────────────────── */

export default function CreateProgramScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const route = useRoute<ScreenProps['route']>();
  const editProgramId = route.params?.programId;
  const userId = useAuthStore((s) => s.user?.id);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const createProgram = useProgramStore((s) => s.createProgram);
  const updateProgram = useProgramStore((s) => s.updateProgram);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const editingProgram = useProgramStore((s) =>
    editProgramId ? s.programs.find((p) => p.id === editProgramId) : undefined
  );

  const isEditing = !!editProgramId;

  const [name, setName] = useState(() => editingProgram?.name ?? '');
  const [startDate, setStartDate] = useState<string | null>(() => editingProgram?.start_date ?? null);
  const [endDate, setEndDate] = useState<string | null>(() => editingProgram?.end_date ?? null);
  const [dayMap, setDayMap] = useState<Record<number, { label: string; exercises: ProgramDayExercise[] }>>(() => {
    if (!editingProgram) return {};
    const map: Record<number, { label: string; exercises: ProgramDayExercise[] }> = {};
    for (const d of editingProgram.days) {
      map[d.day_of_week] = { label: d.label, exercises: d.exercises };
    }
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);

  const assignedDays = useMemo(() => Object.keys(dayMap).map(Number), [dayMap]);

  // Pick up result from ProgramDayEditor when we come back into focus
  useFocusEffect(
    useCallback(() => {
      const result = consumeDayEditResult();
      if (result) {
        setDayMap((prev) => ({
          ...prev,
          [result.dayIndex]: { label: result.label, exercises: result.exercises },
        }));
      }
    }, [])
  );

  const durationWeeks = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    return Math.max(1, Math.ceil((e - s) / (7 * 24 * 60 * 60 * 1000)));
  }, [startDate, endDate]);

  const handleDayTap = useCallback((dayIndex: number) => {
    const existing = dayMap[dayIndex];
    startDayEdit({
      dayIndex,
      dayName: WEEKDAY_LONG[dayIndex],
      label: existing?.label ?? '',
      exercises: existing?.exercises ?? [],
    });
    navigation.navigate('ProgramDayEditor');
  }, [dayMap, navigation]);

  const clearDay = useCallback((dayIndex: number) => {
    setDayMap((prev) => {
      const next = { ...prev };
      delete next[dayIndex];
      return next;
    });
  }, []);

  const formatDate = (date: string | null) => {
    if (!date) return 'Select';
    const d = new Date(date);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Enter a program name');
      return;
    }
    if (assignedDays.length === 0) {
      Alert.alert('Error', 'Add at least one workout day');
      return;
    }
    if (!userId) return;

    setSaving(true);
    try {
      const days: ProgramDay[] = Object.entries(dayMap).map(([dow, { label, exercises }]) => ({
        day_of_week: Number(dow),
        label,
        exercises,
      }));

      if (isEditing) {
        const { error } = await updateProgram(editProgramId!, name.trim(), startDate, endDate, days);
        if (error) {
          Alert.alert('Error', error);
          return;
        }
        await fetchPrograms(userId);
      } else {
        const { error } = await createProgram(userId, name.trim(), startDate, endDate, days);
        if (error) {
          Alert.alert('Error', error);
          return;
        }
      }

      navigation.goBack();
    } catch (e: any) {
      if (__DEV__) console.error('Program save error:', e);
      Alert.alert('Error', e?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{isEditing ? 'Edit Program' : 'New Program'}</Text>
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
          {/* Program Name */}
          <Text style={styles.label}>Program Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Hypertrophy Block, PPL"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
          />

          {/* Date Range */}
          <Text style={styles.label}>Duration</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowStartCal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateBtnLabel}>Start</Text>
              <Text style={[styles.dateBtnValue, !startDate && styles.datePlaceholder]}>
                {formatDate(startDate)}
              </Text>
            </TouchableOpacity>

            <Ionicons name="arrow-forward" size={ms(16)} color={colors.textTertiary} />

            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => setShowEndCal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.dateBtnLabel}>End</Text>
              <Text style={[styles.dateBtnValue, !endDate && styles.datePlaceholder]}>
                {formatDate(endDate)}
              </Text>
            </TouchableOpacity>
          </View>
          {durationWeeks > 0 && (
            <Text style={styles.durationHint}>
              {durationWeeks} week{durationWeeks !== 1 ? 's' : ''}
            </Text>
          )}

          {/* Weekly Schedule */}
          <Text style={styles.label}>Weekly Schedule</Text>
          <Text style={styles.hint}>Tap a day to define its exercises. This repeats every week.</Text>

          {WEEKDAY_SHORT.map((day, i) => {
            const entry = dayMap[i];
            const isAssigned = !!entry && entry.exercises.length > 0;

            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayRow, isAssigned && styles.dayRowAssigned]}
                onPress={() => handleDayTap(i)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dayName, isAssigned && styles.dayNameAssigned]}>{day}</Text>
                {isAssigned ? (
                  <View style={styles.dayInfo}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayLabel} numberOfLines={1}>{entry.label}</Text>
                      <Text style={styles.dayExCount}>{entry.exercises.length} exercises</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => clearDay(i)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons name="close-circle" size={ms(18)} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.dayInfo}>
                    <Text style={styles.dayRestLabel}>Rest Day</Text>
                    <Ionicons name="add-circle-outline" size={ms(18)} color={colors.textTertiary} />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}

          <View style={{ height: sw(80) }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save Button */}
      <View style={[styles.footer, { paddingBottom: sw(24) }]}>
        <TouchableOpacity
          style={[styles.saveButton, (saving || !name.trim() || assignedDays.length === 0) && styles.saveDisabled]}
          onPress={handleSave}
          disabled={saving || !name.trim() || assignedDays.length === 0}
          activeOpacity={0.7}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : isEditing ? 'Update Program' : 'Create Program'}</Text>
        </TouchableOpacity>
      </View>

      {/* Calendar modals */}
      <CalendarPicker
        visible={showStartCal}
        value={startDate}
        onSelect={setStartDate}
        onClose={() => setShowStartCal(false)}
        colors={colors}
      />
      <CalendarPicker
        visible={showEndCal}
        value={endDate}
        minDate={startDate}
        onSelect={setEndDate}
        onClose={() => setShowEndCal(false)}
        colors={colors}
      />
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: { flex: 1 },
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
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: sw(16),
  },
  label: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
    marginBottom: sw(6),
    marginTop: sw(14),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hint: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
    marginBottom: sw(8),
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(12),
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },

  // Date range
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
  },
  dateBtn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(12),
    gap: sw(2),
  },
  dateBtnLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  dateBtnValue: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
  },
  datePlaceholder: {
    color: colors.textTertiary,
  },
  durationHint: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    marginTop: sw(6),
    textAlign: 'center',
  },

  // Day rows
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    paddingHorizontal: sw(14),
    paddingVertical: sw(12),
    marginBottom: sw(4),
    borderRadius: 0,
  },
  dayRowAssigned: {
    borderLeftWidth: sw(3),
    borderLeftColor: colors.accent,
  },
  dayName: {
    width: sw(36),
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.bold,
  },
  dayNameAssigned: {
    color: colors.textPrimary,
  },
  dayInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  dayLabel: {
    color: colors.textPrimary,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
  },
  dayExCount: {
    color: colors.textTertiary,
    fontSize: ms(10),
    fontFamily: Fonts.medium,
  },
  dayRestLabel: {
    flex: 1,
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
  },

  // Footer
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
    borderRadius: 0,
    paddingVertical: sw(14),
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
  },
});
