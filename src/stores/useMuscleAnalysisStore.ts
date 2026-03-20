import { create } from 'zustand';
import type { WorkoutWithDetails, CatalogEntry } from './useWorkoutStore';
import { toSlug } from '../utils/muscleVolume';
import type { MuscleGroup } from '../components/body/musclePathData';
import { CATEGORY_TO_GROUPS, GROUP_LABELS } from '../components/body/musclePathData';

/* ─── Slug → MuscleGroup mapping ──────────────────────── */

const SLUG_TO_GROUP: Record<string, MuscleGroup> = {
  chest: 'chest',
  'upper-back': 'back',
  'lower-back': 'back',
  trapezius: 'back',
  deltoids: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearm: 'forearms',
  abs: 'abs',
  obliques: 'abs',
  quadriceps: 'quads',
  tibialis: 'quads',
  adductors: 'quads',
  hamstring: 'hamstrings',
  gluteal: 'glutes',
  calves: 'calves',
};

const ALL_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'abs', 'quads', 'hamstrings', 'glutes', 'calves',
];

/* ─── Category fallback for slug resolution ───────────── */

const CATEGORY_TO_SLUGS: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['upper-back', 'lower-back', 'trapezius'],
  Shoulders: ['deltoids'],
  Arms: ['biceps', 'triceps', 'forearm'],
  Legs: ['quadriceps', 'hamstring', 'gluteal', 'calves', 'adductors', 'tibialis'],
  Core: ['abs', 'obliques'],
};

/* ─── Fixed recovery time per group (hours) ──────────── */

const GROUP_RECOVERY_HOURS: Record<MuscleGroup, number> = {
  chest: 72,       // 3 days
  back: 72,        // 3 days
  shoulders: 48,   // 2 days
  biceps: 48,      // 2 days
  triceps: 48,     // 2 days
  forearms: 36,    // 1.5 days
  abs: 36,         // 1.5 days
  quads: 72,       // 3 days
  hamstrings: 72,  // 3 days
  glutes: 72,      // 3 days
  calves: 48,      // 2 days
};

/* ─── Types ───────────────────────────────────────────── */

export interface MuscleExerciseEntry {
  name: string;
  date: string;
  sets: { kg: number; reps: number }[];
  isPrimary: boolean;
}

export interface MuscleGroupAnalysis {
  weeklyVolume: number;
  prevWeekVolume: number;
  volumeRatio: number;       // 0-1 relative to maxGroupVolume
  sessionCount: number;
  lastTrainedAt: string | null;
  recoveryHours: number;
  recoveryRemaining: number;
  recoveryPercent: number;
  exercises: MuscleExerciseEntry[];
  undertrained: boolean;
  overtrained: boolean;
}

export interface WeeklyAnalysis {
  weekStart: string;
  weekEnd: string;
  totalVolume: number;
  workoutCount: number;
  groups: Record<MuscleGroup, MuscleGroupAnalysis>;
  mostTrained: MuscleGroup | null;
  leastTrained: MuscleGroup | null;
  suggestedFocus: MuscleGroup[];
  maxGroupVolume: number;
  totalDuration: number;   // seconds
  neglectedExercise: string | null;
  weeklyWin: { text: string; emoji: string } | null;
  thisWeekExercises: string[];
}

/* ─── Week bounds helper ──────────────────────────────── */

function getWeekBounds(now: Date): { thisStart: Date; thisEnd: Date; prevStart: Date; prevEnd: Date } {
  // "This week" = past 7 days (today back to 6 days ago)
  const thisEnd = new Date(now);
  thisEnd.setHours(23, 59, 59, 999);

  const thisStart = new Date(thisEnd);
  thisStart.setDate(thisEnd.getDate() - 6);
  thisStart.setHours(0, 0, 0, 0);

  // "Prev week" = the 7 days before that
  const prevEnd = new Date(thisStart);
  prevEnd.setTime(thisStart.getTime() - 1);

  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevEnd.getDate() - 6);
  prevStart.setHours(0, 0, 0, 0);

  return { thisStart, thisEnd, prevStart, prevEnd };
}

/* ─── Pure analysis function ──────────────────────────── */

export function computeWeeklyAnalysis(
  workouts: WorkoutWithDetails[],
  catalogMap: Record<string, CatalogEntry>,
): WeeklyAnalysis {
  const now = new Date();
  const { thisStart, thisEnd, prevStart, prevEnd } = getWeekBounds(now);

  const thisWeek = workouts.filter((w) => {
    const t = new Date(w.created_at).getTime();
    return t >= thisStart.getTime() && t <= thisEnd.getTime();
  });
  const prevWeek = workouts.filter((w) => {
    const t = new Date(w.created_at).getTime();
    return t >= prevStart.getTime() && t <= prevEnd.getTime();
  });

  // Per-group accumulators
  const groupVolume: Record<MuscleGroup, number> = {} as any;
  const prevGroupVolume: Record<MuscleGroup, number> = {} as any;
  const groupSessions: Record<MuscleGroup, Set<string>> = {} as any;
  const groupLastTrained: Record<MuscleGroup, string | null> = {} as any;
  const groupExercises: Record<MuscleGroup, MuscleExerciseEntry[]> = {} as any;
  const exerciseNames = new Set<string>();
  const prevExerciseNames = new Set<string>();

  for (const g of ALL_GROUPS) {
    groupVolume[g] = 0;
    prevGroupVolume[g] = 0;
    groupSessions[g] = new Set();
    groupLastTrained[g] = null;
    groupExercises[g] = [];
  }

  function processWorkouts(
    wkts: WorkoutWithDetails[],
    volMap: Record<MuscleGroup, number>,
    isThisWeek: boolean,
  ) {
    for (const w of wkts) {
      const workoutDate = w.created_at;
      for (const ex of w.exercises) {
        const vol = ex.sets
          .filter((s) => s.completed)
          .reduce((sum, s) => sum + s.kg * s.reps, 0);
        if (vol === 0) continue;

        if (isThisWeek) exerciseNames.add(ex.name);
        if (!isThisWeek) prevExerciseNames.add(ex.name);

        // Resolve muscles
        let primary = ex.primary_muscles;
        let secondary = ex.secondary_muscles;
        if ((!primary || primary.length === 0) && (!secondary || secondary.length === 0)) {
          const cat = catalogMap[ex.name];
          if (cat) {
            primary = cat.primary_muscles;
            secondary = cat.secondary_muscles;
          }
        }

        const hasMuscleData =
          (primary && primary.length > 0) || (secondary && secondary.length > 0);

        const primaryGroups = new Set<MuscleGroup>();

        if (hasMuscleData) {
          for (const raw of primary || []) {
            const slug = toSlug(raw);
            if (slug && SLUG_TO_GROUP[slug]) {
              const group = SLUG_TO_GROUP[slug];
              volMap[group] += vol;
              primaryGroups.add(group);
              if (isThisWeek) {
                groupExercises[group].push({
                  name: ex.name,
                  date: workoutDate,
                  sets: ex.sets.filter((s) => s.completed).map((s) => ({ kg: s.kg, reps: s.reps })),
                  isPrimary: true,
                });
              }
            }
          }
          for (const raw of secondary || []) {
            const slug = toSlug(raw);
            if (slug && SLUG_TO_GROUP[slug]) {
              const group = SLUG_TO_GROUP[slug];
              volMap[group] += vol * 0.5;
              // Secondary muscles get volume credit but don't count as sessions/lastTrained
              if (isThisWeek) {
                groupExercises[group].push({
                  name: ex.name,
                  date: workoutDate,
                  sets: ex.sets.filter((s) => s.completed).map((s) => ({ kg: s.kg, reps: s.reps })),
                  isPrimary: false,
                });
              }
            }
          }
        } else if (ex.category) {
          const slugs = CATEGORY_TO_SLUGS[ex.category];
          if (slugs) {
            for (const s of slugs) {
              const group = SLUG_TO_GROUP[s];
              if (group) {
                volMap[group] += vol;
                primaryGroups.add(group);
                if (isThisWeek) {
                  groupExercises[group].push({
                    name: ex.name,
                    date: workoutDate,
                    sets: ex.sets.filter((s) => s.completed).map((s) => ({ kg: s.kg, reps: s.reps })),
                    isPrimary: true,
                  });
                }
              }
            }
          }
        }

        if (isThisWeek) {
          for (const g of primaryGroups) {
            groupSessions[g].add(w.id);
            const prev = groupLastTrained[g];
            if (!prev || new Date(workoutDate) > new Date(prev)) {
              groupLastTrained[g] = workoutDate;
            }
          }
        }
      }
    }
  }

  processWorkouts(thisWeek, groupVolume, true);
  processWorkouts(prevWeek, prevGroupVolume, false);

  const maxGroupVolume = Math.max(...Object.values(groupVolume), 1);

  // Build per-group analysis
  const groups: Record<MuscleGroup, MuscleGroupAnalysis> = {} as any;
  let mostTrained: MuscleGroup | null = null;
  let leastTrained: MuscleGroup | null = null;
  let maxVol = 0;
  let minVol = Infinity;
  let anyTrained = false;

  for (const g of ALL_GROUPS) {
    const vol = groupVolume[g];
    const ratio = maxGroupVolume > 0 ? vol / maxGroupVolume : 0;
    const sessionCount = groupSessions[g].size;
    const lastTrained = groupLastTrained[g];

    // Recovery — fixed hours per group
    const recoveryHours = GROUP_RECOVERY_HOURS[g];
    const elapsed = lastTrained
      ? (now.getTime() - new Date(lastTrained).getTime()) / (1000 * 60 * 60)
      : recoveryHours;
    const recoveryRemaining = Math.max(0, recoveryHours - elapsed);
    const recoveryPercent = Math.min(100, recoveryHours > 0 ? (elapsed / recoveryHours) * 100 : 100);

    // Flags
    const undertrained = vol > 0 ? vol < maxGroupVolume * 0.3 : false;
    const overtrained = sessionCount > 3;

    groups[g] = {
      weeklyVolume: Math.round(vol),
      prevWeekVolume: Math.round(prevGroupVolume[g]),
      volumeRatio: ratio,
      sessionCount,
      lastTrainedAt: lastTrained,
      recoveryHours: Math.round(recoveryHours),
      recoveryRemaining: Math.round(recoveryRemaining * 10) / 10,
      recoveryPercent: Math.round(recoveryPercent),
      exercises: groupExercises[g],
      undertrained,
      overtrained,
    };

    if (vol > maxVol) { maxVol = vol; mostTrained = g; }
    if (vol > 0 && vol < minVol) { minVol = vol; leastTrained = g; anyTrained = true; }
    if (vol > 0) anyTrained = true;
  }

  if (!anyTrained) { mostTrained = null; leastTrained = null; }

  // Smart insight — collect all applicable, pick one per week
  function computeWeeklyWin(
    grps: Record<MuscleGroup, MuscleGroupAnalysis>,
    wkts: WorkoutWithDetails[],
    exNames: Set<string>,
    prevExNames: Set<string>,
    totalVol: number,
    prevTotalVol: number,
  ): { text: string; emoji: string } | null {
    const insights: { text: string; emoji: string }[] = [];

    // 1. Biggest muscle group volume increase
    let bestDelta = 0;
    let bestGroup: MuscleGroup | null = null;
    for (const g of ALL_GROUPS) {
      const d = grps[g];
      if (d.prevWeekVolume > 0 && d.weeklyVolume > d.prevWeekVolume) {
        const pct = ((d.weeklyVolume - d.prevWeekVolume) / d.prevWeekVolume) * 100;
        if (pct > bestDelta) { bestDelta = pct; bestGroup = g; }
      }
    }
    if (bestGroup && bestDelta >= 10) {
      insights.push({
        text: `Your ${GROUP_LABELS[bestGroup].toLowerCase()} volume increased ${Math.round(bestDelta)}%.`,
        emoji: '\u{1F4AA}',
      });
    }

    // 2. Skipped a group trained last week
    for (const g of ALL_GROUPS) {
      if (grps[g].prevWeekVolume > 0 && grps[g].weeklyVolume === 0) {
        insights.push({
          text: `You skipped ${GROUP_LABELS[g].toLowerCase()} this week.`,
          emoji: '\u{1F440}',
        });
        break; // only one
      }
    }

    // 3. Total volume up vs last week
    if (prevTotalVol > 0 && totalVol > prevTotalVol) {
      const pct = Math.round(((totalVol - prevTotalVol) / prevTotalVol) * 100);
      if (pct >= 5) {
        insights.push({
          text: `Total volume up ${pct}% from last week.`,
          emoji: '\u{1F4C8}',
        });
      }
    }

    // 4. Most active day of the week
    if (wkts.length >= 3) {
      const dayCounts: Record<number, number> = {};
      for (const w of wkts) {
        const day = new Date(w.created_at).getDay();
        dayCounts[day] = (dayCounts[day] || 0) + 1;
      }
      let topDay = 0;
      let topCount = 0;
      for (const [day, count] of Object.entries(dayCounts)) {
        if (count > topCount) { topCount = count; topDay = Number(day); }
      }
      if (topCount >= 2) {
        const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
        insights.push({
          text: `You're most active on ${dayNames[topDay]}.`,
          emoji: '\u{1F4C5}',
        });
      }
    }

    // 5. Session milestone
    if (wkts.length >= 5) {
      insights.push({ text: `${wkts.length}-session week. Strong consistency.`, emoji: '\u{1F525}' });
    }

    // 6. Exercise variety
    const newExercises = Array.from(exNames).filter((n) => !prevExNames.has(n));
    if (newExercises.length >= 2) {
      insights.push({
        text: `You added ${newExercises.length} new exercises this week.`,
        emoji: '\u{2728}',
      });
    }

    if (insights.length === 0) return null;

    // Rotate deterministically: use week-of-year to pick
    const weekNum = Math.floor(thisStart.getTime() / (7 * 24 * 60 * 60 * 1000));
    return insights[weekNum % insights.length];
  }

  // Suggested focus: recovered >= 90% AND (volume == 0 OR undertrained)
  const suggestedFocus = ALL_GROUPS.filter((g) => {
    const a = groups[g];
    return a.recoveryPercent >= 90 && (a.weeklyVolume === 0 || a.undertrained);
  });

  return {
    weekStart: thisStart.toISOString(),
    weekEnd: thisEnd.toISOString(),
    totalVolume: Math.round(Object.values(groupVolume).reduce((a, b) => a + b, 0)),
    workoutCount: thisWeek.length,
    groups,
    mostTrained,
    leastTrained,
    suggestedFocus,
    maxGroupVolume: Math.round(maxGroupVolume),
    totalDuration: thisWeek.reduce((sum, w) => sum + (w.duration || 0), 0),
    neglectedExercise: Array.from(prevExerciseNames).find((n) => !exerciseNames.has(n)) ?? null,
    weeklyWin: computeWeeklyWin(
      groups, thisWeek, exerciseNames, prevExerciseNames,
      Math.round(Object.values(groupVolume).reduce((a, b) => a + b, 0)),
      Math.round(Object.values(prevGroupVolume).reduce((a, b) => a + b, 0)),
    ),
    thisWeekExercises: Array.from(exerciseNames),
  };
}

/* ─── Zustand store ───────────────────────────────────── */

interface MuscleAnalysisState {
  analysis: WeeklyAnalysis | null;
  selectedMuscle: MuscleGroup | null;
  setSelectedMuscle: (group: MuscleGroup | null) => void;
  recompute: (workouts: WorkoutWithDetails[], catalogMap: Record<string, CatalogEntry>) => void;
}

export const useMuscleAnalysisStore = create<MuscleAnalysisState>((set) => ({
  analysis: null,
  selectedMuscle: null,

  setSelectedMuscle: (group) => set({ selectedMuscle: group }),

  recompute: (workouts, catalogMap) => {
    const analysis = computeWeeklyAnalysis(workouts, catalogMap);
    set({ analysis });
  },
}));
