import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { useFoodLogStore } from '../../stores/useFoodLogStore';
import { useProteinPowderStore, type ProteinPowder } from '../../stores/useProteinPowderStore';
import type { SupplementConfig } from '../../stores/useSupplementStore';
import { findMealConfig } from '../food/groupEntriesByMeal';
import { sanitizeDecimal } from '../food/decimalInput';
import ProteinPowderManager, { powderMacros } from './ProteinPowderManager';
import CardDetailSheet, { CardDetailHero, CardDetailSectionLabel, CardDetailBar, CardDetailFooter } from './CardDetailSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  config: SupplementConfig;
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

/** The account whose meal slots this session already loaded (Home may not load them itself). */
let mealsLoadedFor: string | null = null;

/** Protein powder: pick a powder and any number of servings, then add (also logged as a snack). */
function ProteinPowderModal({ visible, onClose, config }: Props) {
  return (
    <CardDetailSheet visible={visible} onClose={onClose}>
      <ProteinPowderContent config={config} onClose={onClose} />
    </CardDetailSheet>
  );
}

/** Mounted only while the popup is open. */
function ProteinPowderContent({ config, onClose }: Omit<Props, 'visible'>) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = useThemeStore((s) => s.mode) === 'dark';
  const userId = useAuthStore((s) => s.user?.id);
  const powders = useProteinPowderStore((s) => s.powders);
  const loaded = useProteinPowderStore((s) => s.powdersLoaded);
  const lastPowderId = useProteinPowderStore((s) => s.lastPowderId);
  const total = useProteinPowderStore((s) => s.todayServings);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [servings, setServings] = useState('1');
  const [managing, setManaging] = useState(false);
  /** Manage was opened from "Add powder": the manager starts on its add form. */
  const [addNew, setAddNew] = useState(false);
  const openAdd = useCallback(() => { setAddNew(true); setManaging(true); }, []);
  const toggleManage = useCallback(() => { setAddNew(false); setManaging((m) => !m); }, []);
  // A powder just added goes straight back to the list, picked, ready to log.
  const handleAdded = useCallback((powder: ProteinPowder) => {
    setSelectedId(powder.id);
    setAddNew(false);
    setManaging(false);
  }, []);
  const [adding, setAdding] = useState(false);
  // A ref, not just state: two taps before a re-render would both see adding = false.
  const addingRef = useRef(false);

  useEffect(() => {
    if (!userId) return;
    if (!loaded) useProteinPowderStore.getState().loadPowders(userId);
    // The snack goes in the user's own snack meal: make sure their meals are known (Home may
    // not have loaded them), once per account per session.
    if (mealsLoadedFor !== userId) {
      mealsLoadedFor = userId;
      useFoodLogStore.getState().fetchMealConfigs(userId);
    }
  }, [userId, loaded]);

  // The last-used powder first, else the first one; a deleted pick falls back the same way.
  const selected = powders.find((p) => p.id === selectedId)
    ?? powders.find((p) => p.id === lastPowderId)
    ?? powders[0];

  const amount = Number(servings);
  const valid = amount > 0 && Number.isFinite(amount);
  const step = (dir: 1 | -1) => {
    Haptics.selectionAsync();
    const next = Math.max(0.5, Math.round(((valid ? amount : 1) + dir * 0.5) * 2) / 2);
    setServings(fmt(next));
  };

  const handleAdd = useCallback(async () => {
    if (!userId || !selected || !valid || addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const slot = findMealConfig(useFoodLogStore.getState().mealConfigs, 'snack')?.slot ?? 'snack';
    const ok = await useProteinPowderStore.getState().logServings(userId, selected, amount, slot);
    addingRef.current = false;
    setAdding(false);
    if (ok) onClose();
    else Alert.alert("Couldn't add that", 'Check your connection and try again.');
  }, [userId, selected, valid, amount, onClose]);

  const handleUndo = useCallback(() => {
    if (userId) useProteinPowderStore.getState().undoLast(userId);
  }, [userId]);

  const goal = config.dailyGoal;
  const pct = goal > 0 ? Math.round((total / goal) * 100) : 0;
  const remaining = Math.max(0, goal - total);
  const noPowders = loaded && powders.length === 0;

  return (
    <>
      <CardDetailHero
        value={fmt(total)}
        valueColor={total > goal && goal > 0 ? config.color : undefined}
        unit="servings"
        label={total > goal ? `${fmt(total - goal)} over goal` : `${fmt(remaining)} to go`}
        stats={[{ value: fmt(goal), label: 'Goal' }, { value: `${pct}%`, label: 'Done' }]}
        dividerColor={colors.surface}
      />
      <CardDetailSectionLabel>{config.name}</CardDetailSectionLabel>
      <CardDetailBar pct={pct} color={config.color} trackColor={colors.surface} />

      <View style={styles.sectionHeader}>
        <CardDetailSectionLabel spaced>Powder</CardDetailSectionLabel>
        {!noPowders && (
          <Pressable onPress={toggleManage} hitSlop={8} accessibilityRole="button">
            <Text style={styles.manage}>{managing ? 'Done' : 'Manage'}</Text>
          </Pressable>
        )}
      </View>

      {noPowders || managing ? (
        <ProteinPowderManager startAdding={noPowders || addNew} onAdded={handleAdded} />
      ) : (
        <View style={styles.list} accessibilityRole="radiogroup">
          {powders.map((p) => {
            const active = p.id === selected?.id;
            return (
              <Pressable
                key={p.id}
                style={[styles.powder, active && { borderColor: config.color, backgroundColor: config.color + '14' }]}
                onPress={() => { Haptics.selectionAsync(); setSelectedId(p.id); }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={styles.powderInfo}>
                  <Text style={styles.powderName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.powderMacros} numberOfLines={1}>{powderMacros(p)} per serving</Text>
                </View>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={ms(18)} color={active ? config.color : colors.textTertiary} />
              </Pressable>
            );
          })}
          <Pressable style={styles.addPowder} onPress={openAdd} accessibilityRole="button">
            <Ionicons name="add-circle-outline" size={ms(17)} color={colors.accent} />
            <Text style={styles.addPowderText}>Add powder</Text>
          </Pressable>
        </View>
      )}

      {!!selected && !managing && (
        <>
          <CardDetailSectionLabel spaced>Servings</CardDetailSectionLabel>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Fewer servings">
              <Ionicons name="remove" size={ms(18)} color={colors.textPrimary} />
            </Pressable>
            <TextInput
              style={styles.servingsInput}
              value={servings}
              onChangeText={(v) => setServings(sanitizeDecimal(v))}
              keyboardType="decimal-pad"
              keyboardAppearance={isDark ? 'dark' : 'light'}
              selectTextOnFocus
              accessibilityLabel="Servings"
            />
            <Pressable style={styles.stepBtn} onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="More servings">
              <Ionicons name="add" size={ms(18)} color={colors.textPrimary} />
            </Pressable>
          </View>
          <Text style={styles.preview}>{valid ? powderMacros(selected, amount) : 'Enter how many servings'}</Text>
          <Pressable
            style={[styles.addBtn, (!valid || adding) && styles.disabled]}
            onPress={handleAdd}
            disabled={!valid || adding}
            accessibilityRole="button"
          >
            <Ionicons name="add-circle-outline" size={ms(18)} color={colors.textOnAccent} />
            <Text style={styles.addText}>
              {adding ? 'Adding…' : `Add ${valid ? fmt(amount) : ''} ${amount === 1 ? 'serving' : 'servings'}`}
            </Text>
          </Pressable>
          <Text style={styles.note}>Also added to Snacks in your food diary.</Text>
        </>
      )}

      <CardDetailFooter onClose={onClose} onUndo={handleUndo} showUndo={total > 0} />
    </>
  );
}

export default React.memo(ProteinPowderModal);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
    },
    manage: {
      color: colors.accent,
      fontSize: ms(13),
      lineHeight: ms(18),
      fontFamily: Fonts.semiBold,
      marginBottom: sw(8),
    },
    list: {
      gap: sw(6),
    },
    powder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
      paddingVertical: sw(10),
      paddingHorizontal: sw(12),
      borderRadius: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.surface,
    },
    powderInfo: {
      flex: 1,
      gap: sw(2),
    },
    powderName: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    powderMacros: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
    addPowder: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
      paddingVertical: sw(8),
      paddingHorizontal: sw(4),
    },
    addPowderText: {
      color: colors.accent,
      fontSize: ms(14),
      lineHeight: ms(19),
      fontFamily: Fonts.semiBold,
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(10),
    },
    stepBtn: {
      width: sw(44),
      height: sw(44),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    servingsInput: {
      flex: 1,
      height: sw(44),
      borderRadius: sw(12),
      backgroundColor: colors.surface,
      color: colors.textPrimary,
      fontSize: ms(18),
      fontFamily: Fonts.bold,
      textAlign: 'center',
      paddingVertical: 0,
    },
    preview: {
      color: colors.textSecondary,
      fontSize: ms(12),
      lineHeight: ms(17),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginTop: sw(8),
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      height: sw(48),
      borderRadius: sw(14),
      marginTop: sw(12),
      backgroundColor: colors.accent,
    },
    addText: {
      color: colors.textOnAccent,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.bold,
    },
    disabled: {
      opacity: 0.4,
    },
    note: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(15),
      fontFamily: Fonts.medium,
      textAlign: 'center',
      marginTop: sw(6),
      marginBottom: sw(4),
    },
  });
