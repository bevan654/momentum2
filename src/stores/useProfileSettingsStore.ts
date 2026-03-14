import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'profile_settings';

export type MeasBodyPart = 'chest' | 'waist' | 'hips' | 'neck' | 'shoulders' | 'bicep' | 'forearm' | 'thigh' | 'calf';
export type MeasSide = 'left' | 'right';
export type MeasPump = 'no_pump' | 'pumped';

export interface MeasDefault {
  part: MeasBodyPart;
  side: MeasSide;
  pump: MeasPump;
}

export const MEAS_BODY_PARTS: { key: MeasBodyPart; label: string; group: string; hasSides: boolean }[] = [
  { key: 'chest', label: 'Chest', group: 'Core', hasSides: false },
  { key: 'waist', label: 'Waist', group: 'Core', hasSides: false },
  { key: 'hips', label: 'Hips', group: 'Core', hasSides: false },
  { key: 'neck', label: 'Neck', group: 'Core', hasSides: false },
  { key: 'shoulders', label: 'Shoulders', group: 'Core', hasSides: false },
  { key: 'bicep', label: 'Bicep', group: 'Arms', hasSides: true },
  { key: 'forearm', label: 'Forearm', group: 'Arms', hasSides: true },
  { key: 'thigh', label: 'Thigh', group: 'Legs', hasSides: true },
  { key: 'calf', label: 'Calf', group: 'Legs', hasSides: true },
];

export type TimeRange = '1W' | '2W' | '1M' | '6M' | '1Y';

export const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '1W', label: '1 Week' },
  { key: '2W', label: '2 Weeks' },
  { key: '1M', label: '1 Month' },
  { key: '6M', label: '6 Months' },
  { key: '1Y', label: '1 Year' },
];

export type BodyFatMethod = 'tape' | 'calipers' | 'bia' | 'bod_pod' | 'dexa';

export const BODY_FAT_METHODS: { key: BodyFatMethod; label: string; short: string }[] = [
  { key: 'tape', label: 'Tape Method', short: 'Tape' },
  { key: 'calipers', label: 'Skinfold Calipers', short: 'Calipers' },
  { key: 'bia', label: 'Smart Scale', short: 'BIA' },
  { key: 'bod_pod', label: 'Bod Pod', short: 'Bod Pod' },
  { key: 'dexa', label: 'DEXA Scan', short: 'DEXA' },
];

export interface LabTracker {
  id: 'weight' | 'measurements' | 'body_fat';
  label: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_LAB_TRACKERS: LabTracker[] = [
  { id: 'weight', label: 'Weight', enabled: true, order: 0 },
  { id: 'measurements', label: 'Measurements', enabled: true, order: 1 },
  { id: 'body_fat', label: 'Fat %', enabled: true, order: 2 },
];

interface ProfileSettingsState {
  showStreakOnProfile: boolean;
  showStreakOnLeaderboard: boolean;
  showRecoveryPercent: boolean;
  showRankLabels: boolean;
  labTrackers: LabTracker[];
  defaultWeightRange: TimeRange;
  defaultBodyFatMethod: BodyFatMethod;
  defaultMeasurement: MeasDefault;
  initialized: boolean;
  setShowStreakOnProfile: (value: boolean) => void;
  setShowStreakOnLeaderboard: (value: boolean) => void;
  setShowRecoveryPercent: (value: boolean) => void;
  setShowRankLabels: (value: boolean) => void;
  setLabTrackerEnabled: (id: string, enabled: boolean) => void;
  reorderLabTrackers: (trackers: LabTracker[]) => void;
  resetLabTrackers: () => void;
  setDefaultWeightRange: (range: TimeRange) => void;
  setDefaultBodyFatMethod: (method: BodyFatMethod) => void;
  setDefaultMeasurement: (meas: MeasDefault) => void;
  loadSettings: () => Promise<void>;
}

function migrateTrackers(saved: LabTracker[]): LabTracker[] {
  const ids = new Set(saved.map((t) => t.id));
  const labelMap = Object.fromEntries(DEFAULT_LAB_TRACKERS.map((t) => [t.id, t.label]));
  const merged = saved.map((t) => ({ ...t, label: labelMap[t.id] ?? t.label }));
  for (const def of DEFAULT_LAB_TRACKERS) {
    if (!ids.has(def.id)) {
      merged.push({ ...def, order: merged.length });
    }
  }
  return merged;
}

function persist(state: ProfileSettingsState) {
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
    showStreakOnProfile: state.showStreakOnProfile,
    showStreakOnLeaderboard: state.showStreakOnLeaderboard,
    showRecoveryPercent: state.showRecoveryPercent,
    showRankLabels: state.showRankLabels,
    labTrackers: state.labTrackers,
    defaultWeightRange: state.defaultWeightRange,
    defaultBodyFatMethod: state.defaultBodyFatMethod,
    defaultMeasurement: state.defaultMeasurement,
  }));
}

export const useProfileSettingsStore = create<ProfileSettingsState>((set, get) => ({
  showStreakOnProfile: true,
  showStreakOnLeaderboard: true,
  showRecoveryPercent: false,
  showRankLabels: true,
  labTrackers: DEFAULT_LAB_TRACKERS,
  defaultWeightRange: '1W' as TimeRange,
  defaultBodyFatMethod: 'tape' as BodyFatMethod,
  defaultMeasurement: { part: 'chest' as MeasBodyPart, side: 'left' as MeasSide, pump: 'no_pump' as MeasPump },
  initialized: false,

  setShowStreakOnProfile: (value: boolean) => {
    set({ showStreakOnProfile: value });
    persist(get());
  },

  setShowStreakOnLeaderboard: (value: boolean) => {
    set({ showStreakOnLeaderboard: value });
    persist(get());
  },

  setShowRecoveryPercent: (value: boolean) => {
    set({ showRecoveryPercent: value });
    persist(get());
  },

  setShowRankLabels: (value: boolean) => {
    set({ showRankLabels: value });
    persist(get());
  },

  setLabTrackerEnabled: (id: string, enabled: boolean) => {
    const trackers = get().labTrackers.map((t) =>
      t.id === id ? { ...t, enabled } : t,
    );
    set({ labTrackers: trackers });
    persist(get());
  },

  reorderLabTrackers: (trackers: LabTracker[]) => {
    set({ labTrackers: trackers.map((t, i) => ({ ...t, order: i })) });
    persist(get());
  },

  resetLabTrackers: () => {
    set({ labTrackers: DEFAULT_LAB_TRACKERS });
    persist(get());
  },

  setDefaultWeightRange: (range: TimeRange) => {
    set({ defaultWeightRange: range });
    persist(get());
  },

  setDefaultBodyFatMethod: (method: BodyFatMethod) => {
    set({ defaultBodyFatMethod: method });
    persist(get());
  },

  setDefaultMeasurement: (meas: MeasDefault) => {
    set({ defaultMeasurement: meas });
    persist(get());
  },

  loadSettings: async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      set({
        showStreakOnProfile: data.showStreakOnProfile ?? true,
        showStreakOnLeaderboard: data.showStreakOnLeaderboard ?? true,
        showRecoveryPercent: data.showRecoveryPercent ?? true,
        showRankLabels: data.showRankLabels ?? true,
        labTrackers: migrateTrackers(data.labTrackers ?? DEFAULT_LAB_TRACKERS),
        defaultWeightRange: data.defaultWeightRange ?? '1W',
        defaultBodyFatMethod: data.defaultBodyFatMethod ?? 'tape',
        defaultMeasurement: data.defaultMeasurement ?? { part: 'chest', side: 'left', pump: 'no_pump' },
        initialized: true,
      });
    } else {
      set({ initialized: true });
    }
  },
}));
