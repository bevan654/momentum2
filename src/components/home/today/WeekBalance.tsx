import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';
import { useWorkoutStore, type WorkoutWithDetails } from '../../../stores/useWorkoutStore';
import { toCanonical, CANONICAL_TO_UI_CATEGORY } from '../../../constants/muscles';
import ActivityRings from './ActivityRings';
import SectionLabel from './SectionLabel';
import MuscleMapPair from '../../body/MuscleMapPair';
import { useMuscleMapColors, useMuscleMapLevel } from '../../body/useBodyMap';
import { useRegionWeightLookup } from '../../../hooks/useRegionWeightLookup';
import { useMuscleLoad } from '../../../hooks/useMuscleLoad';
import { regionVolume, relativeValues } from '../../../utils/muscleVolume';
import { useToday } from '../../../hooks/useToday';

const GROUPS = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] as const;
const DAYS = 6;
const MINI = sw(28);
const BODY_H = sw(150);

/** Completed sets per muscle group over the last 7 days (primary muscles, like Training Balance). */
function weekCutoff(today: string) {
  const now = new Date(`${today}T12:00:00`);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - DAYS).getTime();
}

function groupSets(workouts: WorkoutWithDetails[], cutoff: number): { counts: Record<string, number>; total: number } {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const g of GROUPS) counts[g] = 0;
  for (const w of workouts) {
    if (new Date(w.created_at).getTime() < cutoff) continue;
    for (const ex of w.exercises) {
      const done = ex.sets.filter((st) => st.completed && st.set_type !== 'warmup').length;
      if (done === 0) continue;
      total += done;
      const counted = new Set<string>();
      for (const m of ex.primary_muscles) {
        const c = toCanonical(m);
        const g = c ? CANONICAL_TO_UI_CATEGORY[c] : undefined;
        if (g && g in counts && !counted.has(g)) {
          counted.add(g);
          counts[g] += done;
        }
      }
    }
  }
  return { counts, total };
}

interface Props {
  onOpen: () => void;
}

/** Weekly working-set target per muscle group (a common hypertrophy guideline): rings fill toward it. */
const WEEKLY_TARGET = 10;

/**
 * Home "This week" section (no card): front/back body shaded by this week's training beside six small rings, one per
 * muscle group, filling toward 10 sets a week. Opens the Recovery tab.
 */
function WeekBalance({ onOpen }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  const workouts = useWorkoutStore((st) => st.workouts);
  const today = useToday();
  const cutoff = useMemo(() => weekCutoff(today), [today]);
  const { counts, total } = useMemo(() => groupSets(workouts, cutoff), [workouts, cutoff]);

  // Body heat for the same 7 days (effective load, as on the Lab tab's body map).
  const lookup = useRegionWeightLookup();
  const load = useMuscleLoad();
  const { bodyValues, sessions } = useMemo(() => {
    const recent = workouts.filter((w) => new Date(w.created_at).getTime() >= cutoff);
    const workingExercises = recent.flatMap((w) => w.exercises.map((ex) => ({
      ...ex,
      sets: ex.sets.filter((set) => set.completed && set.set_type !== 'warmup'),
    })).filter((ex) => ex.sets.length > 0));
    return {
      bodyValues: relativeValues(regionVolume(workingExercises, lookup, load)),
      sessions: recent.length,
    };
  }, [workouts, lookup, load, cutoff]);
  const mapColors = useMuscleMapColors();
  const [level] = useMuscleMapLevel();

  const weakest = total > 0 ? GROUPS.reduce((a, b) => (counts[b] < counts[a] ? b : a)) : null;

  return (
    <TouchableOpacity style={s.tile} onPress={onOpen} activeOpacity={0.85} accessibilityLabel="Training this week">
      <SectionLabel label="This week" detail={`${total} sets · ${sessions} ${sessions === 1 ? 'workout' : 'workouts'}`} chevron />

      <View style={s.row}>
        <View pointerEvents="none">
          <MuscleMapPair values={bodyValues} level={level} colors={mapColors} height={BODY_H} gap={sw(4)} glow />
        </View>
        <View style={s.grid}>
          {GROUPS.map((g) => {
            const n = counts[g];
            const hit = n >= WEEKLY_TARGET;
            const isWeak = g === weakest && !hit;
            const color = isWeak ? colors.accentOrange : hit ? colors.accentGreen : colors.accent;
            return (
              <View key={g} style={s.item}>
                <View style={s.ring}>
                  <ActivityRings rings={[{ key: g, progress: n / WEEKLY_TARGET, color }]} size={MINI} stroke={sw(3.5)} />
                  <View style={s.ringCenter} pointerEvents="none">
                    {hit ? (
                      <Ionicons name="checkmark" size={ms(13)} color={colors.accentGreen} />
                    ) : (
                      <Text style={[s.count, n === 0 && s.countZero]}>{n}</Text>
                    )}
                  </View>
                </View>
                <Text style={[s.label, isWeak && { color: colors.accentOrange }]} numberOfLines={1}>{g}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(WeekBalance);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tile: {
      marginTop: sw(18),
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: sw(10) },
    grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: sw(10) },
    item: { alignItems: 'center', gap: sw(4), width: '33.33%' },
    ring: { width: MINI, height: MINI },
    ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    count: { color: colors.textSecondary, fontSize: ms(10), lineHeight: ms(13), fontFamily: Fonts.bold },
    countZero: { color: colors.textTertiary },
    label: { color: colors.textTertiary, fontSize: ms(9), lineHeight: ms(12), fontFamily: Fonts.semiBold },
  });
