import { type ActiveSet } from './types';

export const REST_NOTIF_ID = 'rest-timer';

// ── Constants ──────────────────────────────────────────

export const EMPTY_SET: ActiveSet = {
  kg: '',
  reps: '',
  completed: false,
  set_type: 'working',
  parent_set_number: null,
};

export const EXERCISE_TYPE_CYCLE: Record<string, string> = {
  weighted: 'bodyweight',
  bodyweight: 'duration',
  duration: 'weighted+bodyweight',
  'weighted+bodyweight': 'weighted',
};

export const SET_TYPE_CYCLE: Record<string, string> = {
  working: 'warmup',
  warmup: 'drop',
  drop: 'failure',
  failure: 'working',
};
