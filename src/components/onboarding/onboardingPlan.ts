/** Onboarding step copy, activity levels and the calorie/macro recommendation. */

export const STEP_CONFIG = [
  { title: 'Tell us about yourself', subtitle: 'We use this to personalise your experience' },
  { title: 'Set your daily goals', subtitle: 'Recommended targets based on your details — adjust if you like' },
];

export type ActivityKey = 'sedentary' | 'light' | 'moderate' | 'very' | 'athlete';

export const ACTIVITY_OPTIONS: { key: ActivityKey; label: string; description: string; multiplier: number }[] = [
  { key: 'sedentary', label: 'Sedentary',  description: 'Desk job, little exercise',         multiplier: 1.2 },
  { key: 'light',     label: 'Light',      description: 'Light exercise 1–3 days/wk',         multiplier: 1.375 },
  { key: 'moderate',  label: 'Moderate',   description: 'Exercise 3–5 days/wk',               multiplier: 1.55 },
  { key: 'very',      label: 'Very active', description: 'Hard exercise 6–7 days/wk',         multiplier: 1.725 },
  { key: 'athlete',   label: 'Athlete',    description: 'Twice daily training / labour job',  multiplier: 1.9 },
];

type GoalMode = 'cut' | 'maintain' | 'bulk';

export interface Recommendation {
  mode: GoalMode;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const computeRecommendation = (params: {
  gender: string | null;
  ageNum: number;
  heightCm: number;
  weightKg: number;
  goalKg: number;
  activity: ActivityKey | null;
}): Recommendation | null => {
  const { gender, ageNum, heightCm, weightKg, goalKg, activity } = params;
  if (!gender || !activity) return null;
  if (!(ageNum > 0 && heightCm > 0 && weightKg > 0 && goalKg > 0)) return null;

  // Mifflin-St Jeor
  const bmr =
    gender === 'female'
      ? 10 * weightKg + 6.25 * heightCm - 5 * ageNum - 161
      : 10 * weightKg + 6.25 * heightCm - 5 * ageNum + 5;

  const multiplier = ACTIVITY_OPTIONS.find((o) => o.key === activity)!.multiplier;
  const tdee = bmr * multiplier;

  const diff = goalKg - weightKg;
  let mode: GoalMode = 'maintain';
  let calories = tdee;
  if (diff <= -1) {
    mode = 'cut';
    calories = tdee - 500;
  } else if (diff >= 1) {
    mode = 'bulk';
    calories = tdee + 300;
  }

  // Protein: 2.0 g/kg for cut, 1.8 g/kg for bulk/maintain
  const proteinG = Math.round((mode === 'cut' ? 2.0 : 1.8) * weightKg);
  // Fat: 25% of calories
  const fatG = Math.round((calories * 0.25) / 9);
  // Carbs: remainder
  const carbsG = Math.max(0, Math.round((calories - proteinG * 4 - fatG * 9) / 4));

  return {
    mode,
    calories: Math.round(calories / 10) * 10,
    protein: proteinG,
    carbs: carbsG,
    fat: fatG,
  };
};
