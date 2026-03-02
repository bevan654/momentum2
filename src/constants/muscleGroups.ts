export const MUSCLE_GROUP_COLORS: Record<string, string> = {
  Chest: '#EF4444',
  Back: '#3B82F6',
  Shoulders: '#F59E0B',
  Arms: '#8B5CF6',
  Legs: '#34D399',
  Core: '#F97316',
  Cardio: '#EC4899',
  Custom: '#6B7280',
};

export function getMuscleGroupColor(category: string): string {
  return MUSCLE_GROUP_COLORS[category] || MUSCLE_GROUP_COLORS.Custom;
}
