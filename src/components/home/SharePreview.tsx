import React, { useMemo, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useAuthStore } from '../../stores/useAuthStore';
import { useStreakStore } from '../../stores/useStreakStore';
import { useNutritionStore } from '../../stores/useNutritionStore';
import { useSupplementStore } from '../../stores/useSupplementStore';
import { useWeightStore } from '../../stores/useWeightStore';
import { useWorkoutStore } from '../../stores/useWorkoutStore';
import { useProgramStore } from '../../stores/useProgramStore';
import { useRoutineStore } from '../../stores/useRoutineStore';

// Mirror HomeHeader's dev override until real subscription is wired up.
const __DEV_TIER_OVERRIDE__: 'basic' | 'premium' = 'premium';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

function SharePreview({ visible, onClose }: Props) {
  const cardRef = useRef<View>(null);
  const username = useAuthStore((s) => s.profile?.username ?? null);
  const heightCm = useAuthStore((s) => s.profile?.height ?? null);
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const longestStreak = useStreakStore((s) => s.longestStreak);
  const calories = useNutritionStore((s) => s.calories);
  const water = useSupplementStore((s) => s.water);
  const weightKg = useWeightStore((s) => s.current);
  const workouts = useWorkoutStore((s) => s.workouts);
  const activeProgram = useProgramStore((s) => s.activeProgram);
  const getTodaysRoutine = useProgramStore((s) => s.getTodaysRoutine);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const routines = useRoutineStore((s) => s.routines);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const displayName = (username || 'Athlete')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const bmi = useMemo(() => {
    if (!heightCm || !weightKg || heightCm <= 0) return null;
    const m = heightCm / 100;
    return weightKg / (m * m);
  }, [heightCm, weightKg]);

  const liters = (water / 1000).toFixed(1);
  const bestStreak = Math.max(longestStreak, currentStreak);
  const isPremium = __DEV_TIER_OVERRIDE__ === 'premium';

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const monthLabel = `${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;

  // Build month grid (same logic as StreakStrip)
  const monthGrid = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dow = (firstDay.getDay() + 6) % 7;

    const workoutKeys = new Set<string>();
    for (const w of workouts) workoutKeys.add(toDateKey(new Date(w.created_at)));
    const todayKey = toDateKey(today);

    const cells: Array<{ inMonth: boolean; isToday: boolean; isFuture: boolean; hasWorkout: boolean }> = [];
    for (let i = 0; i < dow; i++) cells.push({ inMonth: false, isToday: false, isFuture: false, hasWorkout: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const key = toDateKey(date);
      cells.push({
        inMonth: true,
        isToday: key === todayKey,
        isFuture: key > todayKey,
        hasWorkout: workoutKeys.has(key),
      });
    }
    while (cells.length % 7 !== 0) cells.push({ inMonth: false, isToday: false, isFuture: false, hasWorkout: false });
    return cells;
  }, [workouts, today]);

  // Today's workout context
  const todayWorkout = useMemo(() => {
    const todayRoutine = activeProgram ? getTodaysRoutine() : null;
    if (todayRoutine && activeProgram) {
      return { title: todayRoutine.label, meta: `Week ${getCurrentWeek()} · ${activeProgram.name}` };
    }
    if (activeProgram) return { title: 'Rest Day', meta: activeProgram.name };
    if (routines.length > 0) return { title: 'Open Workout', meta: `${routines.length} routine${routines.length === 1 ? '' : 's'} ready` };
    return { title: 'No Workout Planned', meta: 'Add a routine to get started' };
  }, [activeProgram, getTodaysRoutine, getCurrentWeek, routines]);

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your progress' });
      }
    } catch {
      // silent
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.center} onPress={() => {}}>
          {/* Capturable branded card */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            {/* Brand bar + PRO */}
            <View style={styles.brandRow}>
              <View style={styles.brandLeft}>
                <Ionicons name="flash" size={ms(14)} color={colors.accent} />
                <Text style={styles.brandText}>MOMENTUM</Text>
              </View>
              {isPremium && (
                <View style={styles.proPill}>
                  <Text style={styles.proPillText}>PRO</Text>
                </View>
              )}
            </View>

            {/* Name */}
            <Text style={styles.name}>{displayName}</Text>

            {/* Streak hero */}
            <View style={styles.heroBlock}>
              <Ionicons name="flame" size={ms(72)} color={colors.accent} />
              <View style={styles.heroTextWrap}>
                <Text style={styles.heroValue}>{currentStreak}</Text>
                <Text style={styles.heroLabel}>DAY STREAK</Text>
              </View>
            </View>

            {/* Monthly calendar */}
            <View style={styles.calendarBlock}>
              <Text style={styles.calendarTitle}>{monthLabel}</Text>
              <View style={styles.dayLabelRow}>
                {DAY_LABELS.map((l, i) => (
                  <Text key={i} style={styles.dayLabel}>{l}</Text>
                ))}
              </View>
              <View style={styles.calendarGrid}>
                {monthGrid.map((c, i) => (
                  <View key={i} style={styles.cellSlot}>
                    {c.inMonth && (
                      <View style={[
                        styles.dayDot,
                        c.hasWorkout && { backgroundColor: colors.accent },
                        c.isToday && styles.dayDotToday,
                        c.isFuture && !c.isToday && styles.dayDotFuture,
                      ]} />
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Stats grid 2x2 */}
            <View style={styles.statsGrid}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{calories.toLocaleString()}</Text>
                <Text style={styles.statLabel}>CALORIES</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{liters}<Text style={styles.statUnit}> L</Text></Text>
                <Text style={styles.statLabel}>HYDRATION</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{bmi != null ? bmi.toFixed(1) : '—'}</Text>
                <Text style={styles.statLabel}>BMI</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{bestStreak}</Text>
                <Text style={styles.statLabel}>BEST STREAK</Text>
              </View>
            </View>

            {/* Today's workout */}
            <View style={styles.workoutBlock}>
              <Text style={styles.workoutLabel}>TODAY'S WORKOUT</Text>
              <Text style={styles.workoutTitle} numberOfLines={1}>{todayWorkout.title}</Text>
              <Text style={styles.workoutMeta} numberOfLines={1}>{todayWorkout.meta}</Text>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>TRACKED WITH MOMENTUM</Text>
          </View>

          {/* Action buttons (outside captured area) */}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.cancelBtn]} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare} activeOpacity={0.85}>
              <Ionicons name="share-outline" size={ms(16)} color={colors.textOnAccent} />
              <Text style={styles.shareText}>Share</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default React.memo(SharePreview);

const CARD_W = sw(340);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: sw(20),
  },
  center: {
    alignItems: 'center',
    gap: sw(16),
  },
  card: {
    width: CARD_W,
    backgroundColor: colors.card,
    padding: sw(20),
    gap: sw(14),
  },

  /* Brand bar */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
  },
  brandText: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(16),
    fontFamily: Fonts.extraBold,
    letterSpacing: 2,
  },
  proPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: sw(4),
  },
  proPillText: {
    color: colors.textOnAccent,
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
  },

  name: {
    color: colors.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(28),
    fontFamily: Fonts.bold,
    letterSpacing: -0.4,
  },

  /* Streak hero */
  heroBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(14),
  },
  heroTextWrap: {
    flexShrink: 1,
  },
  heroValue: {
    color: colors.textPrimary,
    fontSize: ms(48),
    lineHeight: ms(52),
    fontFamily: Fonts.extraBold,
    letterSpacing: -1.5,
  },
  heroLabel: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(13),
    fontFamily: Fonts.semiBold,
    letterSpacing: 1,
    marginTop: sw(2),
  },

  /* Calendar */
  calendarBlock: {
    gap: sw(4),
  },
  calendarTitle: {
    color: colors.textPrimary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.4,
  },
  dayLabelRow: {
    flexDirection: 'row',
    marginTop: sw(2),
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    color: colors.textPrimary,
    fontSize: ms(8),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellSlot: {
    width: '14.2857%',
    height: sw(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDot: {
    width: sw(14),
    height: sw(14),
    borderRadius: sw(7),
    backgroundColor: colors.surface,
  },
  dayDotToday: {
    borderWidth: 1,
    borderColor: colors.accent,
  },
  dayDotFuture: {
    opacity: 0.4,
  },

  /* Stats 2x2 */
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(10),
  },
  stat: {
    width: (CARD_W - sw(40) - sw(10)) / 2,
    gap: sw(2),
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(24),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.5,
  },
  statUnit: {
    color: colors.textTertiary,
    fontFamily: Fonts.medium,
    fontSize: ms(13),
  },
  statLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.medium,
    letterSpacing: 0.6,
  },

  /* Today's workout */
  workoutBlock: {
    backgroundColor: colors.surface,
    padding: sw(12),
    gap: sw(2),
  },
  workoutLabel: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.8,
  },
  workoutTitle: {
    color: colors.textPrimary,
    fontSize: ms(16),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
    letterSpacing: -0.2,
  },
  workoutMeta: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },

  footer: {
    color: colors.textTertiary,
    fontSize: ms(9),
    lineHeight: ms(12),
    fontFamily: Fonts.bold,
    letterSpacing: 1.5,
    textAlign: 'center',
  },

  /* Action buttons outside captured card */
  actions: {
    flexDirection: 'row',
    gap: sw(10),
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(6),
    paddingHorizontal: sw(20),
    paddingVertical: sw(12),
    borderRadius: sw(999),
  },
  cancelBtn: {
    backgroundColor: colors.surface,
  },
  cancelText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
  },
  shareBtn: {
    backgroundColor: colors.accent,
  },
  shareText: {
    color: colors.textOnAccent,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
  },
});
