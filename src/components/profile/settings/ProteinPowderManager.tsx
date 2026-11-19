import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useAuthStore } from '../../../stores/useAuthStore';
import { useThemeStore } from '../../../stores/useThemeStore';
import { useProteinPowderStore, type ProteinPowder, type PowderInput } from '../../../stores/useProteinPowderStore';
import { sanitizeDecimal } from '../../food/decimalInput';

/** "120 kcal · P 24 · C 3 · F 1" for one serving. */
export function powderMacros(p: Pick<ProteinPowder, 'calories' | 'protein' | 'carbs' | 'fat'>, servings = 1): string {
  const r = (v: number) => Math.round(v * servings * 10) / 10;
  return `${Math.round(p.calories * servings)} kcal · P ${r(p.protein)} · C ${r(p.carbs)} · F ${r(p.fat)}`;
}

interface FormProps {
  initial?: ProteinPowder;
  onSave: (input: PowderInput) => Promise<boolean>;
  onCancel: () => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}

/** Name plus macros for one serving; calories left blank are worked out from the macros. */
const PowderForm = React.memo(function PowderForm({ initial, onSave, onCancel, styles, colors }: FormProps) {
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const str = (v?: number) => (v != null && v > 0 ? String(v) : '');
  const [name, setName] = useState(initial?.name ?? '');
  const [calories, setCalories] = useState(str(initial?.calories));
  const [protein, setProtein] = useState(str(initial?.protein));
  const [carbs, setCarbs] = useState(str(initial?.carbs));
  const [fat, setFat] = useState(str(initial?.fat));
  const [saving, setSaving] = useState(false);

  const p = Number(protein) || 0;
  const c = Number(carbs) || 0;
  const f = Number(fat) || 0;
  const fromMacros = Math.round(p * 4 + c * 4 + f * 9);
  const kcal = Number(calories) > 0 ? Number(calories) : fromMacros;
  const canSave = name.trim().length > 0 && (kcal > 0 || p > 0) && !saving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave({ name: name.trim(), calories: kcal, protein: p, carbs: c, fat: f });
    setSaving(false);
    if (!ok) Alert.alert("Couldn't save that powder", 'Check your connection and try again.');
  }, [canSave, onSave, name, kcal, p, c, f]);

  const field = (label: string, value: string, set: (v: string) => void, unit: string, placeholder?: string) => (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldBox}>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={(v) => set(sanitizeDecimal(v))}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '0'}
          placeholderTextColor={colors.textTertiary}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          accessibilityLabel={`${label} per serving`}
        />
        <Text style={styles.fieldUnit}>{unit}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.form}>
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="Name (e.g. Vanilla whey)"
        placeholderTextColor={colors.textTertiary}
        keyboardAppearance={isDark ? 'dark' : 'light'}
        accessibilityLabel="Powder name"
      />
      <Text style={styles.hint}>Per serving (one scoop):</Text>
      <View style={styles.fieldRow}>
        {field('Calories', calories, setCalories, 'kcal', fromMacros > 0 ? String(fromMacros) : '0')}
        {field('Protein', protein, setProtein, 'g')}
      </View>
      <View style={styles.fieldRow}>
        {field('Carbs', carbs, setCarbs, 'g')}
        {field('Fat', fat, setFat, 'g')}
      </View>
      <View style={styles.formButtons}>
        <Pressable style={[styles.btn, styles.btnSecondary]} onPress={onCancel} accessibilityRole="button">
          <Text style={styles.btnSecondaryText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.btn, styles.btnPrimary, !canSave && styles.disabled]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
        >
          <Text style={styles.btnPrimaryText}>{saving ? 'Saving…' : initial ? 'Save' : 'Add powder'}</Text>
        </Pressable>
      </View>
    </View>
  );
});

interface Props {
  /** Opens straight into the add form (e.g. no powders yet in the Home picker). */
  startAdding?: boolean;
}

/** The user's protein powders: add, edit and delete (each with its macros per serving). */
function ProteinPowderManager({ startAdding }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((s) => s.user?.id);
  const powders = useProteinPowderStore((s) => s.powders);
  const loaded = useProteinPowderStore((s) => s.powdersLoaded);
  const [editingId, setEditingId] = useState<string | 'new' | null>(startAdding ? 'new' : null);

  useEffect(() => {
    if (userId && !loaded) useProteinPowderStore.getState().loadPowders(userId);
  }, [userId, loaded]);

  const handleAdd = useCallback(async (input: PowderInput) => {
    if (!userId) return false;
    const ok = !!(await useProteinPowderStore.getState().addPowder(userId, input));
    if (ok) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEditingId(null);
    }
    return ok;
  }, [userId]);

  const handleUpdate = useCallback(async (input: PowderInput) => {
    if (!userId || !editingId || editingId === 'new') return false;
    const ok = await useProteinPowderStore.getState().updatePowder(userId, editingId, input);
    if (ok) setEditingId(null);
    return ok;
  }, [userId, editingId]);

  const handleDelete = useCallback((powder: ProteinPowder) => {
    Alert.alert(
      `Delete ${powder.name}?`,
      'Servings you already logged stay in your diary.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!userId) return;
            const ok = await useProteinPowderStore.getState().deletePowder(userId, powder.id);
            if (!ok) Alert.alert("Couldn't delete that powder", 'Check your connection and try again.');
          },
        },
      ],
    );
  }, [userId]);

  const cancel = useCallback(() => setEditingId(null), []);

  return (
    <View style={styles.wrap}>
      {powders.map((p) => (
        editingId === p.id ? (
          <PowderForm key={p.id} initial={p} onSave={handleUpdate} onCancel={cancel} styles={styles} colors={colors} />
        ) : (
          <View key={p.id} style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.rowMacros} numberOfLines={1}>{powderMacros(p)}</Text>
            </View>
            <Pressable onPress={() => setEditingId(p.id)} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`}>
              <Ionicons name="create-outline" size={ms(17)} color={colors.textSecondary} />
            </Pressable>
            <Pressable onPress={() => handleDelete(p)} hitSlop={8} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`Delete ${p.name}`}>
              <Ionicons name="trash-outline" size={ms(17)} color={colors.textTertiary} />
            </Pressable>
          </View>
        )
      ))}
      {editingId === 'new' ? (
        <PowderForm onSave={handleAdd} onCancel={cancel} styles={styles} colors={colors} />
      ) : (
        <Pressable style={styles.addRow} onPress={() => setEditingId('new')} accessibilityRole="button">
          <Ionicons name="add-circle-outline" size={ms(17)} color={colors.accent} />
          <Text style={styles.addText}>{powders.length === 0 ? 'Add your first powder' : 'Add powder'}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default React.memo(ProteinPowderManager);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      gap: sw(6),
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(4),
      paddingVertical: sw(8),
      paddingHorizontal: sw(12),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
    },
    rowInfo: {
      flex: 1,
      gap: sw(2),
    },
    rowName: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    rowMacros: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    iconBtn: {
      width: sw(32),
      height: sw(32),
      alignItems: 'center',
      justifyContent: 'center',
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(10),
    },
    addText: {
      color: colors.accent,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    form: {
      gap: sw(8),
      padding: sw(12),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
    },
    nameInput: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      paddingHorizontal: sw(12),
      height: sw(42),
      borderRadius: sw(10),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    hint: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.semiBold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    fieldRow: {
      flexDirection: 'row',
      gap: sw(8),
    },
    field: {
      flex: 1,
      gap: sw(4),
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    fieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(10),
      height: sw(40),
      borderRadius: sw(10),
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    fieldInput: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.semiBold,
      paddingVertical: 0,
    },
    fieldUnit: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
    },
    formButtons: {
      flexDirection: 'row',
      gap: sw(8),
      marginTop: sw(4),
    },
    btn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      height: sw(40),
      borderRadius: sw(10),
    },
    btnSecondary: {
      backgroundColor: colors.card,
    },
    btnSecondaryText: {
      color: colors.textSecondary,
      fontSize: ms(14),
      fontFamily: Fonts.semiBold,
    },
    btnPrimary: {
      backgroundColor: colors.accent,
    },
    btnPrimaryText: {
      color: colors.textOnAccent,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
    },
    disabled: {
      opacity: 0.4,
    },
  });
