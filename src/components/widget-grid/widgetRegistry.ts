import { sw } from '../../theme/responsive';
import type { WidgetType, WidgetMeta } from '../../types/widget';

export const WIDGET_REGISTRY: Record<WidgetType, WidgetMeta> = {
  nutrition: {
    type: 'nutrition',
    label: 'Nutrition',
    icon: 'nutrition-outline',
    defaultSize: 'medium',
    defaultHeight: sw(280),
    allowedSizes: ['medium', 'large', 'full'],
  },
  water: {
    type: 'water',
    label: 'Water',
    icon: 'water-outline',
    defaultSize: 'medium',
    defaultHeight: sw(160),
    allowedSizes: ['medium', 'large', 'full'],
  },
  creatine: {
    type: 'creatine',
    label: 'Creatine',
    icon: 'flash-outline',
    defaultSize: 'medium',
    defaultHeight: sw(150),
    allowedSizes: ['medium', 'large', 'full'],
  },
  activity: {
    type: 'activity',
    label: 'Activity',
    icon: 'calendar-outline',
    defaultSize: 'full',
    defaultHeight: sw(420),
    allowedSizes: ['large', 'full'],
  },
  logWorkout: {
    type: 'logWorkout',
    label: 'Log Workout',
    icon: 'barbell-outline',
    defaultSize: 'medium',
    defaultHeight: sw(70),
    allowedSizes: ['small', 'medium', 'large', 'full'],
  },
  logFood: {
    type: 'logFood',
    label: 'Log Food',
    icon: 'nutrition-outline',
    defaultSize: 'medium',
    defaultHeight: sw(70),
    allowedSizes: ['small', 'medium', 'large', 'full'],
  },
};
