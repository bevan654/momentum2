import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Linking, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useProteinPowderStore } from '../../stores/useProteinPowderStore';
import { useProfileSettingsStore, BODY_FAT_METHODS, MEAS_BODY_PARTS, TIME_RANGES, type LabTracker, type BodyFatMethod, type MeasDefault, type MeasBodyPart, type MeasSide, type MeasPump, type TimeRange } from '../../stores/useProfileSettingsStore';
import SupplementConfigEditor from './SupplementConfigEditor';
import BottomSheet from '../workout-sheet/BottomSheet';

interface Props {
  onBack: () => void;
}

export default function ProfileSettingsView({ onBack }: Props) {
  const profile = useAuthStore((s) => s.profile);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? sw(90) : 0}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity style={styles.backRow} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={ms(22)} color={colors.textPrimary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>

        {/* 1. Account */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <View style={styles.goalRow}>
            <Text style={styles.fieldLabel}>Username</Text>
            <Text style={styles.usernameDisplay}>{profile?.username || '—'}</Text>
          </View>
        </View>

        {/* 2. Daily Nutrition Goals */}
        <SectionHeader title="Daily Nutrition Goals" />
        <View style={styles.card}>
          <NutritionGoalsEditor />
        </View>

        {/* 3. Body Stats */}
        <SectionHeader title="Body Stats" />
        <View style={styles.card}>
          <BodyStatsEditor />
        </View>

        {/* 4. Supplements */}
        <SectionHeader title="Supplements" />
        <View style={styles.card}>
          <SupplementConfigEditor />
        </View>

        {/* 5. Protein Powder */}
        <SectionHeader title="Protein Powder" />
        <View style={styles.card}>
          <ProteinPowderToggle />
        </View>

        {/* 6. Lab Trackers */}
        <LabTrackersSection />
        <View style={styles.card}>
          <LabTrackersEditor />
        </View>

        {/* 7. Support */}
        <SectionHeader title="Support" />
        <View style={styles.card}>
          <LinkRow label="Privacy Policy" url="https://momentum.app/privacy" />
          <LinkRow label="Terms of Service" url="https://momentum.app/terms" />
          <LinkRow label="Contact Us" url="mailto:support@momentum.app" last />
        </View>

        <View style={{ height: sw(40) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ─── Section Header ─────────────────────────────────────── */

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

/* ─── Nutrition Goals Editor ─────────────────────────────── */

function NutritionGoalsEditor() {
  const userId = useAuthStore((s) => s.user?.id);
  const goals = useFoodLogStore((s) => s.goals);
  const updateGoals = useFoodLogStore((s) => s.updateGoals);
  const waterGoal = useSupplementStore((s) => s.waterGoal);
  const updateSupplementGoals = useSupplementStore((s) => s.updateSupplementGoals);

  const [cal, setCal] = useState(String(goals.calorie_goal));
  const [pro, setPro] = useState(String(goals.protein_goal));
  const [carbs, setCarbs] = useState(String(goals.carbs_goal));
  const [fat, setFat] = useState(String(goals.fat_goal));
  const [waterText, setWaterText] = useState(String(waterGoal));

  const save = useCallback((field: string, value: string, setter: (v: string) => void, original: number) => {
    if (!userId) return;
    const num = parseInt(value, 10);
    if (!isNaN(num) && num > 0) {
      updateGoals(userId, { [field]: num });
    } else {
      setter(String(original));
    }
  }, [userId, updateGoals]);

  const handleWaterBlur = useCallback(() => {
    if (!userId) return;
    const val = parseInt(waterText, 10);
    if (!isNaN(val) && val > 0) {
      updateSupplementGoals(userId, { water_goal: val });
    } else {
      setWaterText(String(waterGoal));
    }
  }, [userId, waterText, waterGoal, updateSupplementGoals]);

  return (
    <View>
      <GoalRow label="Calories" value={cal} onChange={setCal} onBlur={() => save('calorie_goal', cal, setCal, goals.calorie_goal)} unit="kcal" />
      <GoalRow label="Protein" value={pro} onChange={setPro} onBlur={() => save('protein_goal', pro, setPro, goals.protein_goal)} unit="g" />
      <GoalRow label="Carbs" value={carbs} onChange={setCarbs} onBlur={() => save('carbs_goal', carbs, setCarbs, goals.carbs_goal)} unit="g" />
      <GoalRow label="Fat" value={fat} onChange={setFat} onBlur={() => save('fat_goal', fat, setFat, goals.fat_goal)} unit="g" />
      <GoalRow label="Water" value={waterText} onChange={setWaterText} onBlur={handleWaterBlur} unit="ml" />
    </View>
  );
}

function GoalRow({ label, value, onChange, onBlur, unit }: { label: string; value: string; onChange: (v: string) => void; onBlur: () => void; unit: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.goalRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.goalInputWrap}>
        <TextInput
          style={styles.goalInput}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          keyboardType="number-pad"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );
}

/* ─── Body Stats Editor ──────────────────────────────────── */

function BodyStatsEditor() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [weight, setWeight] = useState(String(profile?.starting_weight || ''));
  const [goalWeight, setGoalWeight] = useState(String(profile?.goal_weight || ''));
  const [age, setAge] = useState(String(profile?.age || ''));
  const [height, setHeight] = useState(String(profile?.height || ''));

  const handleWeightBlur = useCallback(() => {
    const val = parseFloat(weight);
    if (!isNaN(val) && val > 0) {
      updateProfile({ starting_weight: val });
    } else {
      setWeight(String(profile?.starting_weight || ''));
    }
  }, [weight, profile, updateProfile]);

  const handleGoalWeightBlur = useCallback(() => {
    const val = parseFloat(goalWeight);
    if (!isNaN(val) && val > 0) {
      updateProfile({ goal_weight: val });
    } else {
      setGoalWeight(String(profile?.goal_weight || ''));
    }
  }, [goalWeight, profile, updateProfile]);

  const handleAgeBlur = useCallback(() => {
    const val = parseInt(age, 10);
    if (!isNaN(val) && val >= 13 && val <= 100) {
      updateProfile({ age: val });
    } else {
      setAge(String(profile?.age || ''));
    }
  }, [age, profile, updateProfile]);

  const handleHeightBlur = useCallback(() => {
    const val = parseFloat(height);
    if (!isNaN(val) && val >= 100 && val <= 250) {
      updateProfile({ height: val });
    } else {
      setHeight(String(profile?.height || ''));
    }
  }, [height, profile, updateProfile]);

  const handleGenderSelect = useCallback((gender: string) => {
    updateProfile({ gender });
  }, [updateProfile]);

  return (
    <View>
      <View style={styles.goalRow}>
        <Text style={styles.fieldLabel}>Gender</Text>
        <View style={styles.genderToggleWrap}>
          <TouchableOpacity
            style={[styles.genderOption, profile?.gender === 'male' && { backgroundColor: colors.accent + '25' }]}
            onPress={() => handleGenderSelect('male')}
            activeOpacity={0.7}
          >
            <Text style={[styles.genderText, profile?.gender === 'male' && { color: colors.accent }]}>Male</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderOption, profile?.gender === 'female' && { backgroundColor: colors.accent + '25' }]}
            onPress={() => handleGenderSelect('female')}
            activeOpacity={0.7}
          >
            <Text style={[styles.genderText, profile?.gender === 'female' && { color: colors.accent }]}>Female</Text>
          </TouchableOpacity>
        </View>
      </View>
      <GoalRow label="Age" value={age} onChange={setAge} onBlur={handleAgeBlur} unit="yrs" />
      <GoalRow label="Height" value={height} onChange={setHeight} onBlur={handleHeightBlur} unit="cm" />
      <GoalRow label="Starting Weight" value={weight} onChange={setWeight} onBlur={handleWeightBlur} unit="kg" />
      <GoalRow label="Goal Weight" value={goalWeight} onChange={setGoalWeight} onBlur={handleGoalWeightBlur} unit="kg" />
    </View>
  );
}

/* ─── Protein Powder Toggle ─────────────────────────────── */

function ProteinPowderToggle() {
  const userId = useAuthStore((s) => s.user?.id);
  const enabled = useProteinPowderStore((s) => s.enabled);
  const setEnabled = useProteinPowderStore((s) => s.setEnabled);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleToggle = useCallback((value: boolean) => {
    if (userId) setEnabled(userId, value);
  }, [userId, setEnabled]);

  return (
    <View style={styles.switchRow}>
      <Text style={styles.fieldLabel}>Enable Protein Powder</Text>
      <Switch
        value={enabled}
        onValueChange={handleToggle}
        trackColor={{ false: colors.accentRed + '60', true: colors.accentGreen + '60' }}
        thumbColor={enabled ? colors.accentGreen : colors.accentRed}
      />
    </View>
  );
}

/* ─── Lab Trackers Section Header ────────────────────────── */

function LabTrackersSection() {
  const resetLabTrackers = useProfileSettingsStore((s) => s.resetLabTrackers);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.labSectionHeader}>
      <Text style={styles.sectionTitle}>Lab Trackers</Text>
      <TouchableOpacity onPress={resetLabTrackers} activeOpacity={0.7}>
        <Text style={styles.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Lab Trackers Editor ────────────────────────────────── */

function LabTrackersEditor() {
  const labTrackers = useProfileSettingsStore((s) => s.labTrackers);
  const setLabTrackerEnabled = useProfileSettingsStore((s) => s.setLabTrackerEnabled);
  const reorderLabTrackers = useProfileSettingsStore((s) => s.reorderLabTrackers);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const sorted = useMemo(
    () => [...labTrackers].sort((a, b) => a.order - b.order),
    [labTrackers],
  );

  const ROW_HEIGHT = sw(52);

  const handleSwap = useCallback((draggedId: string, direction: 'up' | 'down') => {
    const idx = sorted.findIndex((t) => t.id === draggedId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reorderLabTrackers(reordered);
  }, [sorted, reorderLabTrackers]);

  return (
    <View>
      <Text style={styles.labHint}>Drag to reorder how they appear in Labs</Text>
      {sorted.map((tracker, index) => (
        <React.Fragment key={tracker.id}>
          {index > 0 && <View style={styles.labDivider} />}
          <LabTrackerRow
            tracker={tracker}
            onToggle={(enabled) => setLabTrackerEnabled(tracker.id, enabled)}
            onSwap={(dir) => handleSwap(tracker.id, dir)}
            rowHeight={ROW_HEIGHT}
            isFirst={index === 0}
            isLast={index === sorted.length - 1}
            colors={colors}
          />
        </React.Fragment>
      ))}
    </View>
  );
}

const LabTrackerRow = React.memo(function LabTrackerRow({
  tracker,
  onToggle,
  onSwap,
  rowHeight,
  isFirst,
  isLast,
  colors,
}: {
  tracker: LabTracker;
  onToggle: (enabled: boolean) => void;
  onSwap: (direction: 'up' | 'down') => void;
  rowHeight: number;
  isFirst: boolean;
  isLast: boolean;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useSharedValue(0);
  const hasSwapped = useSharedValue(false);

  // Only subscribe to the store slice relevant to this tracker's type
  const defaultWeightRange = useProfileSettingsStore((s) =>
    tracker.id === 'weight' ? s.defaultWeightRange : null,
  );
  const setDefaultWeightRange = useProfileSettingsStore((s) => s.setDefaultWeightRange);
  const defaultBodyFatMethod = useProfileSettingsStore((s) =>
    tracker.id === 'body_fat' ? s.defaultBodyFatMethod : null,
  );
  const setDefaultBodyFatMethod = useProfileSettingsStore((s) => s.setDefaultBodyFatMethod);
  const defaultMeasurement = useProfileSettingsStore((s) =>
    tracker.id === 'measurements' ? s.defaultMeasurement : null,
  );
  const setDefaultMeasurement = useProfileSettingsStore((s) => s.setDefaultMeasurement);
  const [showRangePicker, setShowRangePicker] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const [showMeasPicker, setShowMeasPicker] = useState(false);

  const panGesture = Gesture.Pan()
    .activeOffsetY([-10, 10])
    .onStart(() => {
      'worklet';
      hasSwapped.value = false;
    })
    .onUpdate((e) => {
      'worklet';
      translateY.value = e.translationY;
      if (!hasSwapped.value) {
        if (e.translationY < -rowHeight * 0.4 && !isFirst) {
          hasSwapped.value = true;
          runOnJS(onSwap)('up');
        } else if (e.translationY > rowHeight * 0.4 && !isLast) {
          hasSwapped.value = true;
          runOnJS(onSwap)('down');
        }
      }
    })
    .onEnd(() => {
      'worklet';
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const currentMethodLabel = useMemo(() => {
    if (tracker.id !== 'body_fat' || !defaultBodyFatMethod) return null;
    return BODY_FAT_METHODS.find((m) => m.key === defaultBodyFatMethod)?.short ?? 'Tape';
  }, [tracker.id, defaultBodyFatMethod]);

  const measChipLabel = useMemo(() => {
    if (tracker.id !== 'measurements' || !defaultMeasurement) return null;
    const partDef = MEAS_BODY_PARTS.find((p) => p.key === defaultMeasurement.part);
    if (!partDef) return 'Chest';
    let label = partDef.label;
    if (partDef.hasSides) label += ` ${defaultMeasurement.side === 'left' ? 'L' : 'R'}`;
    if (defaultMeasurement.pump === 'pumped') label += ' · P';
    return label;
  }, [tracker.id, defaultMeasurement]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.labRow, animStyle]}>
        <Ionicons name="reorder-three" size={ms(20)} color={colors.textTertiary} />
        <Text style={[styles.fieldLabel, { flex: 1, marginLeft: sw(10) }]}>{tracker.label}</Text>
        {tracker.id === 'weight' && (
          <TouchableOpacity
            style={styles.methodChip}
            onPress={() => setShowRangePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.methodChipText}>{defaultWeightRange}</Text>
            <Ionicons name="chevron-down" size={ms(12)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {tracker.id === 'measurements' && (
          <TouchableOpacity
            style={styles.methodChip}
            onPress={() => setShowMeasPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.methodChipText}>{measChipLabel}</Text>
            <Ionicons name="chevron-down" size={ms(12)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {tracker.id === 'body_fat' && (
          <TouchableOpacity
            style={styles.methodChip}
            onPress={() => setShowMethodPicker(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.methodChipText}>{currentMethodLabel}</Text>
            <Ionicons name="chevron-down" size={ms(12)} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        <Switch
          value={tracker.enabled}
          onValueChange={onToggle}
          trackColor={{ false: colors.accentRed + '60', true: colors.accentGreen + '60' }}
          thumbColor={tracker.enabled ? colors.accentGreen : colors.accentRed}
        />
        {tracker.id === 'weight' && defaultWeightRange && (
          <DefaultRangePicker
            visible={showRangePicker}
            onClose={() => setShowRangePicker(false)}
            selected={defaultWeightRange}
            onSelect={(key) => { setDefaultWeightRange(key); setShowRangePicker(false); }}
            colors={colors}
          />
        )}
        {tracker.id === 'body_fat' && defaultBodyFatMethod && (
          <DefaultMethodPicker
            visible={showMethodPicker}
            onClose={() => setShowMethodPicker(false)}
            selected={defaultBodyFatMethod}
            onSelect={(key) => { setDefaultBodyFatMethod(key); setShowMethodPicker(false); }}
            colors={colors}
          />
        )}
        {tracker.id === 'measurements' && defaultMeasurement && (
          <DefaultMeasPicker
            visible={showMeasPicker}
            onClose={() => setShowMeasPicker(false)}
            current={defaultMeasurement}
            onSelect={(meas) => { setDefaultMeasurement(meas); setShowMeasPicker(false); }}
            colors={colors}
          />
        )}
      </Animated.View>
    </GestureDetector>
  );
});

/* ─── Default Range Picker ───────────────────────────────── */

const DefaultRangePicker = React.memo(function DefaultRangePicker({
  visible,
  onClose,
  selected,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  selected: TimeRange;
  onSelect: (key: TimeRange) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="45%" modal bgColor={colors.card}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Default Range</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pickerList}>
        {TIME_RANGES.map((range) => {
          const active = range.key === selected;
          return (
            <Pressable
              key={range.key}
              style={[styles.pickerOption, active && { backgroundColor: colors.accent }]}
              onPress={() => onSelect(range.key)}
            >
              <Text style={[styles.pickerOptionText, active && { color: colors.textOnAccent }]}>
                {range.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
});

/* ─── Default Method Picker ──────────────────────────────── */

const DefaultMethodPicker = React.memo(function DefaultMethodPicker({
  visible,
  onClose,
  selected,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  selected: BodyFatMethod;
  onSelect: (key: BodyFatMethod) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="45%" modal bgColor={colors.card}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Default Method</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.pickerList}>
        {BODY_FAT_METHODS.map((method) => {
          const active = method.key === selected;
          return (
            <Pressable
              key={method.key}
              style={[styles.pickerOption, active && { backgroundColor: colors.accent }]}
              onPress={() => onSelect(method.key)}
            >
              <Text style={[styles.pickerOptionText, active && { color: colors.textOnAccent }]}>
                {method.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
});

/* ─── Default Measurement Picker ─────────────────────────── */

const MEAS_GROUPS = ['Core', 'Arms', 'Legs'];

const DefaultMeasPicker = React.memo(function DefaultMeasPicker({
  visible,
  onClose,
  current,
  onSelect,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  current: MeasDefault;
  onSelect: (meas: MeasDefault) => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [part, setPart] = useState<MeasBodyPart>(current.part);
  const [side, setSide] = useState<MeasSide>(current.side);
  const [pump, setPump] = useState<MeasPump>(current.pump);

  // Sync local state when current changes (e.g. reset)
  useEffect(() => {
    setPart(current.part);
    setSide(current.side);
    setPump(current.pump);
  }, [current.part, current.side, current.pump]);

  const partDef = MEAS_BODY_PARTS.find((p) => p.key === part);

  const handleDone = useCallback(() => {
    onSelect({ part, side, pump });
  }, [part, side, pump, onSelect]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="75%" modal bgColor={colors.card}>
      <View style={styles.pickerHeader}>
        <Text style={styles.pickerTitle}>Default View</Text>
        <TouchableOpacity onPress={handleDone}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.measPickerScroll}>
        {/* Side toggle */}
        <Text style={styles.measPickerLabel}>Side</Text>
        <View style={styles.measToggleRow}>
          <Pressable
            style={[styles.measToggleChip, side === 'left' && { backgroundColor: colors.accent }]}
            onPress={() => setSide('left')}
          >
            <Text style={[styles.measToggleText, side === 'left' && { color: colors.textOnAccent }]}>Left</Text>
          </Pressable>
          <Pressable
            style={[styles.measToggleChip, side === 'right' && { backgroundColor: colors.accent }]}
            onPress={() => setSide('right')}
          >
            <Text style={[styles.measToggleText, side === 'right' && { color: colors.textOnAccent }]}>Right</Text>
          </Pressable>
        </View>

        {/* Pump toggle */}
        <Text style={styles.measPickerLabel}>Pump State</Text>
        <View style={styles.measToggleRow}>
          <Pressable
            style={[styles.measToggleChip, pump === 'no_pump' && { backgroundColor: colors.accent }]}
            onPress={() => setPump('no_pump')}
          >
            <Text style={[styles.measToggleText, pump === 'no_pump' && { color: colors.textOnAccent }]}>No Pump</Text>
          </Pressable>
          <Pressable
            style={[styles.measToggleChip, pump === 'pumped' && { backgroundColor: colors.accent }]}
            onPress={() => setPump('pumped')}
          >
            <Text style={[styles.measToggleText, pump === 'pumped' && { color: colors.textOnAccent }]}>Pumped</Text>
          </Pressable>
        </View>

        {/* Body part grid */}
        <Text style={styles.measPickerLabel}>Body Part</Text>
        {MEAS_GROUPS.map((group) => (
          <View key={group}>
            <Text style={styles.measGroupLabel}>{group}</Text>
            <View style={styles.measPartGrid}>
              {MEAS_BODY_PARTS.filter((p) => p.group === group).map((bp) => {
                const active = bp.key === part;
                return (
                  <Pressable
                    key={bp.key}
                    style={[styles.pickerOption, { flexBasis: '29%', flexGrow: 1 }, active && { backgroundColor: colors.accent }]}
                    onPress={() => setPart(bp.key)}
                  >
                    <Text style={[styles.pickerOptionText, active && { color: colors.textOnAccent }]}>{bp.label}</Text>
                    {bp.hasSides && (
                      <Text style={[styles.measPartSub, active && { color: colors.textOnAccent + 'AA' }]}>L / R</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </BottomSheet>
  );
});

/* ─── Shared Components ──────────────────────────────────── */

function LinkRow({ label, url, last }: { label: string; url: string; last?: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.linkRow, !last && styles.linkRowBorder]}
      onPress={() => Linking.openURL(url)}
      activeOpacity={0.7}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="open-outline" size={ms(16)} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: sw(20),
    paddingBottom: sw(40),
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(16),
  },
  backText: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: sw(20),
    marginBottom: sw(8),
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: sw(12),
    padding: sw(16),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  fieldLabel: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  usernameDisplay: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  textInput: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(12),
    paddingVertical: sw(8),
    marginTop: sw(8),
  },
  errorText: {
    color: colors.accentRed,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
    marginTop: sw(4),
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(6),
  },
  goalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  goalInput: {
    width: sw(70),
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
    backgroundColor: colors.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(10),
    paddingVertical: sw(6),
    textAlign: 'center',
  },
  unitText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    width: sw(28),
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(8),
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sw(12),
  },
  linkRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  linkText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.medium,
  },
  genderToggleWrap: {
    flexDirection: 'row' as const,
    gap: sw(6),
  },
  genderOption: {
    paddingHorizontal: sw(14),
    paddingVertical: sw(6),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  genderText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  labSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: sw(20),
    marginBottom: sw(8),
  },
  resetText: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  labHint: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginBottom: sw(8),
  },
  labRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
  },
  labDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.cardBorder,
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    backgroundColor: colors.surface,
    borderRadius: sw(6),
    paddingHorizontal: sw(10),
    paddingVertical: sw(4),
    marginRight: sw(8),
  },
  methodChipText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sw(20),
    paddingBottom: sw(12),
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  pickerTitle: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
  },
  pickerDoneText: {
    color: colors.accent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  pickerList: {
    paddingHorizontal: sw(20),
    paddingTop: sw(16),
    paddingBottom: sw(34),
    gap: sw(8),
  },
  pickerOption: {
    alignItems: 'center',
    paddingVertical: sw(14),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
  },
  pickerOptionText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(19),
    fontFamily: Fonts.semiBold,
  },
  measPickerScroll: {
    paddingHorizontal: sw(20),
    paddingTop: sw(16),
    paddingBottom: sw(34),
  },
  measPickerLabel: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: sw(8),
    marginTop: sw(4),
  },
  measToggleRow: {
    flexDirection: 'row',
    gap: sw(6),
    marginBottom: sw(16),
  },
  measToggleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(8),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  measToggleText: {
    color: colors.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  measGroupLabel: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: sw(8),
    marginTop: sw(4),
  },
  measPartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(8),
    marginBottom: sw(12),
  },
  measPartSub: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
});
