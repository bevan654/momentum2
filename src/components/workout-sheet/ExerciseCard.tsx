import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Modal,
  Pressable,
  findNodeHandle,
  UIManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import type { ActiveExercise } from '../../stores/useActiveWorkoutStore';
import MusclePill from '../workouts/MusclePill';
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
  const linkSuperset = useActiveWorkoutStore((s) => s.linkSuperset);
  const unlinkSuperset = useActiveWorkoutStore((s) => s.unlinkSuperset);

  const isSupersetted = exercise.supersetWith !== null;

  /* ── Dropdown state ────────────────────────────────── */

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<View>(null);

  const openMenu = useCallback(() => {
    const node = findNodeHandle(triggerRef.current);
    if (node) {
      UIManager.measure(node, (_x, _y, width, height, pageX, pageY) => {
        setMenuPos({
          top: pageY + height + sw(4),
          right: SCREEN_WIDTH - (pageX + width),
        });
        setMenuOpen(true);
      });
    } else {
      setMenuOpen(true);
    }
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const menuAction = useCallback(
    (fn: () => void) => {
      closeMenu();
      fn();
    },
    [closeMenu],
  );

  /* ── Menu items ────────────────────────────────────── */

  type MenuItem = { icon: string; label: string; color: string; onPress: () => void; disabled?: boolean };

  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      {
        icon: 'chevron-up-outline',
        label: 'Move Up',
        color: colors.textPrimary,
        onPress: () => menuAction(() => moveExercise(exerciseIndex, 'up')),
        disabled: exerciseIndex === 0,
      },
      {
        icon: 'chevron-down-outline',
        label: 'Move Down',
        color: colors.textPrimary,
        onPress: () => menuAction(() => moveExercise(exerciseIndex, 'down')),
        disabled: isLast,
      },
      {
        icon: 'swap-horizontal-outline',
        label: 'Replace Exercise',
        color: colors.textPrimary,
        onPress: () => menuAction(() => onReplace(exerciseIndex)),
      },
    ];

    if (!isLast) {
      items.push({
        icon: isSupersetted ? 'link' : 'link-outline',
        label: isSupersetted ? 'Remove Superset' : 'Superset',
        color: isSupersetted ? colors.accent : colors.textPrimary,
        onPress: () =>
          menuAction(() =>
            isSupersetted ? unlinkSuperset(exerciseIndex) : linkSuperset(exerciseIndex),
          ),
      });
    }

    items.push({
      icon: 'trash-outline',
      label: 'Remove Exercise',
      color: colors.accentRed,
      onPress: () => menuAction(() => removeExercise(exerciseIndex)),
    });

    return items;
  }, [
    colors, exerciseIndex, isLast, isSupersetted,
    moveExercise, onReplace, linkSuperset, unlinkSuperset, removeExercise, menuAction,
  ]);

  return (
    <View style={styles.card}>
      {/* Header: title + dropdown trigger on same line */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.name} numberOfLines={1}>{exercise.name}</Text>
          {exercise.category && <MusclePill category={exercise.category} />}
        </View>

        <TouchableOpacity
          ref={triggerRef}
          onPress={openMenu}
          style={styles.menuTrigger}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="ellipsis-horizontal" size={ms(16)} color={colors.textSecondary} />
        </TouchableOpacity>
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
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          addSet(exerciseIndex);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="add" size={ms(14)} color={colors.accent} />
        <Text style={styles.addSetText}>Add Set</Text>
      </TouchableOpacity>

      {/* Dropdown menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.overlay} onPress={closeMenu}>
          <View style={[styles.menu, { top: menuPos.top, right: menuPos.right }]}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.menuItem,
                  item.disabled && styles.menuItemDisabled,
                  i < menuItems.length - 1 && styles.menuItemBorder,
                ]}
                onPress={item.onPress}
                disabled={item.disabled}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={item.icon as any}
                  size={ms(15)}
                  color={item.disabled ? colors.textTertiary + '40' : item.color}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    { color: item.disabled ? colors.textTertiary + '40' : item.color },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
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
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
    marginRight: sw(8),
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(20),
    flexShrink: 1,
  },
  menuTrigger: {
    width: sw(30),
    height: sw(26),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(8),
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

  /* ── Dropdown ──────────────────────────────────────── */
  overlay: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    minWidth: sw(180),
    backgroundColor: colors.card,
    borderRadius: sw(12),
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: sw(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    paddingVertical: sw(10),
    paddingHorizontal: sw(14),
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  menuItemText: {
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(18),
  },
});
