import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import {
  useProgramStore,
  startDayEdit,
  consumeDayEditResult,
  type ProgramDay,
  type ProgramDayExercise,
} from '../stores/useProgramStore';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

type ScreenProps = NativeStackScreenProps<WorkoutsStackParamList, 'CreateProgram'>;

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/* ─── Inline calendar picker ────────────────────────── */

function CalendarPicker({
  visible,
  value,
  minDate,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  value: string | null;
  minDate?: string | null;
  onSelect: (date: string) => void;
  onClose: () => void;
  colors: ThemeColors;
}) {
  const today = new Date();
  const initial = value ? new Date(value) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  useEffect(() => {
    if (visible) {
      const d = value ? new Date(value) : new Date();
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [visible, value]);

  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Monday-based: 0=Mon, 6=Sun
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [viewYear, viewMonth]);

  const goBack = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const goForward = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };

  const isDisabled = (day: number) => {
    if (!minDate) return false;
    const d = new Date(viewYear, viewMonth, day);
    return d < new Date(minDate);
  };

  const isToday = (day: number) => {
    return today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const isSelected = (day: number) => {
    if (!value) return false;
    const v = new Date(value);
    return v.getFullYear() === viewYear && v.getMonth() === viewMonth && v.getDate() === day;
  };

  const selectDay = (day: number) => {
    const m = String(viewMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onSelect(`${viewYear}-${m}-${d}`);
    onClose();
  };

  const st = useMemo(() => calendarStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={st.overlay} activeOpacity={1} onPress={onClose}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={st.card} onStartShouldSetResponder={() => true}>
          {/* Month nav */}
          <View style={st.navRow}>
            <TouchableOpacity onPress={goBack} style={st.navBtn}>
              <Ionicons name="chevron-back" size={ms(20)} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={st.monthTitle}>{MONTH_NAMES[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={goForward} style={st.navBtn}>
              <Ionicons name="chevron-forward" size={ms(20)} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Day-of-week headers */}
          <View style={st.dowRow}>
            {DOW_HEADERS.map((d, i) => (
              <Text key={i} style={st.dowText}>{d}</Text>
            ))}
          </View>

          {/* Day grid */}
          <View style={st.grid}>
            {days.map((day, i) => {
              if (day === null) return <View key={`e-${i}`} style={st.cell} />;
              const disabled = isDisabled(day);
              const selected = isSelected(day);
              const todayCell = isToday(day);
              return (
                <TouchableOpacity
                  key={`d-${day}`}
                  style={st.cell}
                  onPress={() => !disabled && selectDay(day)}
                  activeOpacity={disabled ? 1 : 0.6}
                >
                  <View style={[st.cellInner, todayCell && !selected && st.cellToday, selected && st.cellSelected]}>
                    <Text style={[st.cellText, todayCell && !selected && st.cellTodayText, disabled && st.cellDisabled, selected && st.cellTextSelected]}>
                      {day}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const calendarStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    padding: sw(16),
    width: '85%',
    maxWidth: sw(360),
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sw(12),
  },
  navBtn: { padding: sw(4) },
  monthTitle: {
    color: colors.textPrimary,
    fontSize: ms(16),
    fontFamily: Fonts.bold,
  },
  dowRow: {
    flexDirection: 'row',
    marginBottom: sw(6),
  },
  dowText: {
    flex: 1,
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.semiBold,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellInner: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(17),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cellSelected: {
    backgroundColor: colors.accent,
  },
  cellText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
  },
  cellDisabled: {
    color: colors.textTertiary,
    opacity: 0.4,
  },
  cellToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cellTodayText: {
    color: colors.accent,
    fontFamily: Fonts.bold,
  },
  cellTextSelected: {
    color: colors.textOnAccent,
    fontFamily: Fonts.bold,
  },
});

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
      dayName: DAYS_FULL[dayIndex],
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
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
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
      console.error('Program save error:', e);
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

          {DAYS.map((day, i) => {
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

  // Summary
  summary: {
    marginTop: sw(16),
    paddingVertical: sw(12),
    alignItems: 'center',
  },
  summaryText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
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
