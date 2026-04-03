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
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useNutrientGoalStore } from '../../stores/useNutrientGoalStore';

/* ─── Props ──────────────────────────────────────────── */

interface Props {
  visible: boolean;
  mealSlot: string;
  targetHour?: number;
  onDismiss: () => void;
  onAdded: () => void;
}


/* ─── Main component ─────────────────────────────────── */

export default function QuickAddModal({ visible, mealSlot, targetHour, onDismiss, onAdded }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);

  /* ── Fade + scale (pure UI-thread) ─── */
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = visible ? 1 : 0;
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  /* ── Store ─── */
  const userId = useAuthStore((st) => st.user?.id);
  const addEntry = useFoodLogStore((st) => st.addEntry);
  const selectedDate = useFoodLogStore((st) => st.selectedDate);
  const microGoals = useNutrientGoalStore((st) => st.microGoals);
  const loaded = useNutrientGoalStore((st) => st.loaded);
  const loadConfigs = useNutrientGoalStore((st) => st.loadConfigs);

  useEffect(() => {
    if (!loaded) loadConfigs();
  }, [loaded, loadConfigs]);

  /* ── Form state ─── */
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [kj, setKj] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [microValues, setMicroValues] = useState<Record<string, string>>({});
  const editSourceRef = useRef<'kcal' | 'kj' | null>(null);

  /* ── Refs for field focus chain ─── */
  const calRef = useRef<TextInput>(null);
  const kjRef = useRef<TextInput>(null);
  const proRef = useRef<TextInput>(null);
  const carbRef = useRef<TextInput>(null);
  const fatRef = useRef<TextInput>(null);

  /* ── kcal ↔ kJ sync ─── */
  const handleCalChange = useCallback((v: string) => {
    editSourceRef.current = 'kcal';
    setCalories(v);
    const n = Number(v);
    setKj(v === '' ? '' : Number.isFinite(n) ? String(Math.round(n * 4.184)) : '');
  }, []);

  const handleKjChange = useCallback((v: string) => {
    editSourceRef.current = 'kj';
    setKj(v);
    const n = Number(v);
    setCalories(v === '' ? '' : Number.isFinite(n) ? String(Math.round(n / 4.184)) : '');
  }, []);

  /* ── Reset on close ─── */
  useEffect(() => {
    if (!visible) {
      setName('');
      setCalories('');
      setKj('');
      setProtein('');
      setCarbs('');
      setFat('');
      setMicroValues({});
      editSourceRef.current = null;
    }
  }, [visible]);

  /* ── Micro value handler ─── */
  const handleMicroChange = useCallback((key: string, value: string) => {
    setMicroValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  /* ── Submit ─── */
  const canSubmit = Number(calories) > 0 || Number(protein) > 0 || Number(carbs) > 0 || Number(fat) > 0;

  const handleAdd = useCallback(() => {
    if (!userId || !canSubmit) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const cal = Number(calories) || 0;
    const pro = Number(protein) || 0;
    const c = Number(carbs) || 0;
    const f = Number(fat) || 0;

    // Build micro fields from form
    const microFields: Record<string, number | null> = {};
    for (const g of microGoals) {
      const val = Number(microValues[g.key]);
      microFields[g.key] = val > 0 ? val : null;
    }

    addEntry(userId, {
      name: name.trim() || 'Quick Add',
      brand: null,
      calories: cal,
      protein: pro,
      carbs: c,
      fat: f,
      meal_type: mealSlot,
      quantity: 1,
      serving_size: 1,
      serving_unit: 'serving',
      is_planned: false,
      ...microFields,
    }, targetHour != null ? selectedDate : undefined, targetHour);

    onAdded();
  }, [userId, canSubmit, name, calories, protein, carbs, fat, mealSlot, targetHour, selectedDate, addEntry, onAdded, microGoals, microValues]);

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
              blurOnSubmit={false}
              keyboardAppearance="dark"
              onSubmitEditing={() => calRef.current?.focus()}
            />

            {/* Calories — split kcal / kJ */}
            <Text style={s.fieldLabel}>Energy</Text>
            <View style={s.energyRow}>
              <View style={s.energyField}>
                <Text style={s.energyLabel}>kcal</Text>
                <TextInput
                  ref={calRef}
                  style={s.energyInput}
                  value={calories}
                  onChangeText={handleCalChange}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary + '30'}
                  keyboardType="numeric"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  keyboardAppearance="dark"
                  onSubmitEditing={() => proRef.current?.focus()}
                />
              </View>
              <View style={s.energyDivider} />
              <View style={s.energyField}>
                <Text style={s.energyLabel}>kJ</Text>
                <TextInput
                  ref={kjRef}
                  style={s.energyInput}
                  value={kj}
                  onChangeText={handleKjChange}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary + '30'}
                  keyboardType="numeric"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  keyboardAppearance="dark"
                  onSubmitEditing={() => proRef.current?.focus()}
                />
              </View>
            </View>
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
                  blurOnSubmit={false}
                  keyboardAppearance="dark"
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
                  blurOnSubmit={false}
                  keyboardAppearance="dark"
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
                  keyboardAppearance="dark"
                />
              </View>
            </View>

            {/* Micros section — only shown if user tracks any */}
            {microGoals.length > 0 && (
              <>
                <Text style={[s.fieldLabel, { marginTop: sw(20) }]}>Micronutrients</Text>
                <View style={s.microCard}>
                  {microGoals.map((g, i) => (
                    <View key={g.key} style={[s.microRow, i === microGoals.length - 1 && s.microRowLast]}>
                      <View style={[s.microDot, { backgroundColor: g.color }]} />
                      <Text style={s.microLabel}>{g.name}</Text>
                      <View style={s.microInputWrap}>
                        <TextInput
                          style={s.microInput}
                          value={microValues[g.key] || ''}
                          onChangeText={(v) => handleMicroChange(g.key, v)}
                          placeholder="0"
                          placeholderTextColor={colors.textTertiary + '30'}
                          keyboardType="decimal-pad"
                          keyboardAppearance="dark"
                        />
                        <Text style={s.microUnit}>{g.unit}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
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

  /* Energy split row */
  energyRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: c.card,
    borderRadius: sw(12),
    marginBottom: sw(4),
    overflow: 'hidden',
  },
  energyField: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: sw(10),
    gap: sw(2),
  },
  energyLabel: {
    color: c.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  energyInput: {
    width: '100%',
    color: c.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(27),
    fontFamily: Fonts.bold,
    textAlign: 'center',
    padding: 0,
  },
  energyDivider: {
    width: sw(1),
    backgroundColor: c.surface,
    marginVertical: sw(10),
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

  /* Micro section */
  microCard: {
    backgroundColor: c.card,
    borderRadius: sw(14),
    paddingVertical: sw(4),
    paddingHorizontal: sw(14),
  },
  microDot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
    paddingVertical: sw(9),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.surface,
  },
  microRowLast: {
    borderBottomWidth: 0,
  },
  microLabel: {
    flex: 1,
    color: c.textSecondary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },
  microInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  microInput: {
    width: sw(56),
    color: c.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    backgroundColor: c.surface,
    borderRadius: sw(8),
    paddingHorizontal: sw(6),
    paddingVertical: sw(4),
  },
  microUnit: {
    color: c.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    width: sw(28),
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
