import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  StyleSheet,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';

/* ─── Props ──────────────────────────────────────────── */

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
  onAdded: () => void;
}

/* ─── Animation configs (hoisted — zero allocation in worklets) */

const FADE_IN = { duration: 200, easing: Easing.out(Easing.cubic) };
const FADE_OUT = { duration: 150, easing: Easing.in(Easing.cubic) };

/* ─── Main component ─────────────────────────────────── */

export default function QuickAddModal({ visible, mealSlot, targetHour, onDismiss, onAdded }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  /* ── Fade + scale (pure UI-thread) ─── */
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, visible ? FADE_IN : FADE_OUT);
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.94 + progress.value * 0.06 }],
  }));

  /* ── Store ─── */
  const userId = useAuthStore((st) => st.user?.id);
  const addEntry = useFoodLogStore((st) => st.addEntry);
  const selectedDate = useFoodLogStore((st) => st.selectedDate);

  /* ── Form state ─── */
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  /* ── Refs for field focus chain ─── */
  const calRef = useRef<TextInput>(null);
  const proRef = useRef<TextInput>(null);
  const carbRef = useRef<TextInput>(null);
  const fatRef = useRef<TextInput>(null);

  /* ── Reset on close ─── */
  useEffect(() => {
    if (!visible) {
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    }
  }, [visible]);

  /* ── Submit ─── */
  const canSubmit = Number(calories) > 0 || Number(protein) > 0 || Number(carbs) > 0 || Number(fat) > 0;

  const handleAdd = useCallback(() => {
    if (!userId || !canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const cal = Number(calories) || 0;
    const pro = Number(protein) || 0;
    const c = Number(carbs) || 0;
    const f = Number(fat) || 0;

    addEntry(userId, {
      name: name.trim() || 'Quick Add',
      calories: cal,
      protein: pro,
      carbs: c,
      fat: f,
      meal_type: mealSlot,
      quantity: 1,
      serving_size: 1,
      serving_unit: 'serving',
      is_planned: false,
    }, targetHour != null ? selectedDate : undefined, targetHour);

    onAdded();
  }, [userId, canSubmit, name, calories, protein, carbs, fat, mealSlot, targetHour, selectedDate, addEntry, onAdded]);

  /* ── Computed cal preview ─── */
  const previewCal = useMemo(() => {
    const fromMacros = (Number(protein) || 0) * 4 + (Number(carbs) || 0) * 4 + (Number(fat) || 0) * 9;
    const entered = Number(calories) || 0;
    return entered > 0 ? entered : fromMacros;
  }, [calories, protein, carbs, fat]);

  /* ── Render ─── */
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[s.overlay, animStyle]} collapsable={false}>
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={s.header}>
            <TouchableOpacity onPress={onDismiss} style={s.backBtn} activeOpacity={0.5}>
              <Ionicons name="chevron-back" size={ms(20)} color={colors.textSecondary} />
            </TouchableOpacity>
            <Text style={s.title}>Quick Add</Text>
            <View style={s.headerSpacer} />
          </View>

          <ScrollView
            style={s.flex}
            contentContainerStyle={s.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Calorie preview */}
            <View style={s.calPreview}>
              <Text style={s.calNum}>{previewCal}</Text>
              <Text style={s.calUnit}>kcal</Text>
            </View>

            {/* Name field */}
            <Text style={s.fieldLabel}>Name (optional)</Text>
            <TextInput
              style={s.textField}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Snack, Protein shake..."
              placeholderTextColor={colors.textTertiary + '50'}
              returnKeyType="next"
              onSubmitEditing={() => calRef.current?.focus()}
            />

            {/* Calories */}
            <Text style={s.fieldLabel}>Calories</Text>
            <TextInput
              ref={calRef}
              style={s.numField}
              value={calories}
              onChangeText={setCalories}
              placeholder="0"
              placeholderTextColor={colors.textTertiary + '30'}
              keyboardType="numeric"
              returnKeyType="next"
              selectTextOnFocus
              onSubmitEditing={() => proRef.current?.focus()}
            />
            {!calories && (Number(protein) > 0 || Number(carbs) > 0 || Number(fat) > 0) && (
              <Text style={s.autoCalHint}>Auto-calculated from macros</Text>
            )}

            {/* Macros row */}
            <Text style={[s.fieldLabel, { marginTop: sw(16) }]}>Macros (grams)</Text>
            <View style={s.macroRow}>
              <View style={s.macroField}>
                <View style={[s.macroIndicator, { backgroundColor: colors.protein }]} />
                <Text style={[s.macroLabel, { color: colors.protein }]}>Protein</Text>
                <TextInput
                  ref={proRef}
                  style={s.macroInput}
                  value={protein}
                  onChangeText={setProtein}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary + '30'}
                  keyboardType="numeric"
                  returnKeyType="next"
                  selectTextOnFocus
                  onSubmitEditing={() => carbRef.current?.focus()}
                />
              </View>
              <View style={s.macroField}>
                <View style={[s.macroIndicator, { backgroundColor: colors.carbs }]} />
                <Text style={[s.macroLabel, { color: colors.carbs }]}>Carbs</Text>
                <TextInput
                  ref={carbRef}
                  style={s.macroInput}
                  value={carbs}
                  onChangeText={setCarbs}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary + '30'}
                  keyboardType="numeric"
                  returnKeyType="next"
                  selectTextOnFocus
                  onSubmitEditing={() => fatRef.current?.focus()}
                />
              </View>
              <View style={s.macroField}>
                <View style={[s.macroIndicator, { backgroundColor: colors.fat }]} />
                <Text style={[s.macroLabel, { color: colors.fat }]}>Fat</Text>
                <TextInput
                  ref={fatRef}
                  style={s.macroInput}
                  value={fat}
                  onChangeText={setFat}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary + '30'}
                  keyboardType="numeric"
                  returnKeyType="done"
                  selectTextOnFocus
                />
              </View>
            </View>
          </ScrollView>

          {/* Bottom bar */}
          <View style={s.bottomBar}>
            <TouchableOpacity
              style={[s.addBtn, !canSubmit && s.addBtnDisabled]}
              onPress={handleAdd}
              activeOpacity={0.7}
              disabled={!canSubmit}
            >
              <Ionicons name="flash" size={ms(20)} color={colors.textOnAccent} />
              <Text style={s.addBtnText}>Quick Add</Text>
              {previewCal > 0 && <Text style={s.addBtnCal}>{previewCal} cal</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Animated.View>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────── */

const STATUS_H = StatusBar.currentHeight ?? 0;

const createStyles = (c: ThemeColors) => StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: c.background,
    paddingTop: Platform.OS === 'android' ? STATUS_H + sw(8) : sw(60),
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sw(12),
    marginBottom: sw(16),
  },
  backBtn: {
    width: sw(36),
    height: sw(36),
    borderRadius: sw(12),
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: c.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  headerSpacer: { width: sw(36) },

  /* Content */
  content: {
    paddingHorizontal: sw(20),
    paddingBottom: sw(40),
  },

  /* Cal preview */
  calPreview: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: sw(6),
    marginBottom: sw(24),
  },
  calNum: {
    color: c.textPrimary,
    fontSize: ms(42),
    lineHeight: ms(48),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1,
  },
  calUnit: {
    color: c.textTertiary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },

  /* Fields */
  fieldLabel: {
    color: c.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: sw(6),
  },
  textField: {
    backgroundColor: c.card,
    borderRadius: sw(12),
    paddingHorizontal: sw(14),
    paddingVertical: sw(14),
    color: c.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.medium,
    marginBottom: sw(16),
  },
  numField: {
    backgroundColor: c.card,
    borderRadius: sw(12),
    paddingHorizontal: sw(14),
    paddingVertical: sw(14),
    color: c.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(27),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginBottom: sw(4),
  },
  autoCalHint: {
    color: c.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: sw(8),
  },

  /* Macro row */
  macroRow: {
    flexDirection: 'row',
    gap: sw(8),
  },
  macroField: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: sw(12),
    paddingVertical: sw(12),
    paddingHorizontal: sw(10),
    alignItems: 'center',
    gap: sw(6),
  },
  macroIndicator: {
    width: sw(28),
    height: sw(4),
    borderRadius: sw(2),
  },
  macroLabel: {
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
  },
  macroInput: {
    width: '100%',
    color: c.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    padding: 0,
  },

  /* Bottom bar */
  bottomBar: {
    paddingHorizontal: sw(20),
    paddingVertical: sw(12),
    paddingBottom: sw(16),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.surface,
  },
  addBtn: {
    flexDirection: 'row',
    backgroundColor: c.accent,
    borderRadius: sw(14),
    paddingVertical: sw(16),
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(8),
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: c.textOnAccent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.bold,
  },
  addBtnCal: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
});
