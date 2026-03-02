import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetConfig, WidgetType, WidgetSize, LayoutMode } from '../types/widget';
import { WIDGET_REGISTRY } from '../components/widget-grid/widgetRegistry';
import { reorderAfterDrop, computeFlowLayout } from '../components/widget-grid/gridLayout';
import { SIZE_COLUMNS } from '../components/widget-grid/gridConstants';

const STORAGE_KEY = 'widget_layout_v3';
const FILL_KEY = 'widget_fill_rows';
const TUTORIAL_KEY = 'widget_tutorial_seen';
const LAYOUT_MODE_KEY = 'widget_layout_mode';

const VALID_TYPES = new Set<string>([
  'nutrition', 'water', 'creatine', 'activity', 'logWorkout', 'logFood',
]);

const VALID_SIZES = new Set<string>(['small', 'medium', 'large', 'full']);

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/** Convert legacy widthSlots to WidgetSize */
function slotsToSize(slots: number): WidgetSize {
  if (slots <= 1) return 'small';
  if (slots === 2) return 'medium';
  if (slots === 3) return 'large';
  return 'full';
}

const DEFAULT_LAYOUT: WidgetConfig[] = [
  { id: 'default-nutrition',  type: 'nutrition',   size: 'medium', order: 0 },
  { id: 'default-water',      type: 'water',       size: 'medium', order: 1 },
  { id: 'default-creatine',   type: 'creatine',    size: 'medium', order: 2 },
  { id: 'default-logWorkout', type: 'logWorkout',  size: 'medium', order: 3 },
  { id: 'default-logFood',    type: 'logFood',     size: 'medium', order: 4 },
  { id: 'default-activity',   type: 'activity',    size: 'full',   order: 5 },
];

interface WidgetState {
  widgets: WidgetConfig[];
  editMode: boolean;
  initialized: boolean;
  tutorialSeen: boolean;
  fillRows: boolean;
  layoutMode: LayoutMode;
  measuredHeights: Record<string, number>;

  loadLayout: () => Promise<void>;
  toggleEditMode: () => void;
  toggleFillRows: () => void;
  setLayoutMode: (mode: LayoutMode) => void;
  moveWidget: (id: string, dropY: number) => void;
  moveFreeWidget: (id: string, x: number, y: number) => void;
  resizeWidget: (id: string, newSize: WidgetSize, customHeight: number) => void;
  cycleSize: (id: string) => void;
  addWidget: (type: WidgetType) => void;
  removeWidget: (id: string) => void;
  resetToDefault: () => void;
  setMeasuredHeight: (id: string, height: number) => void;
  dismissTutorial: () => void;
}

let _writeTimer: ReturnType<typeof setTimeout> | null = null;

function persistLayout(widgets: WidgetConfig[]) {
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, 300);
}

export const useWidgetStore = create<WidgetState>((set, get) => ({
  widgets: DEFAULT_LAYOUT,
  editMode: false,
  initialized: false,
  tutorialSeen: true,
  fillRows: true,
  layoutMode: 'freeRoam' as LayoutMode,
  measuredHeights: {},

  loadLayout: async () => {
    try {
      const tutorialRaw = await AsyncStorage.getItem(TUTORIAL_KEY);
      const tutorialSeen = tutorialRaw === 'true';

      const fillRaw = await AsyncStorage.getItem(FILL_KEY);
      const fillRows = fillRaw !== 'false'; // default true

      const modeRaw = await AsyncStorage.getItem(LAYOUT_MODE_KEY);
      const layoutMode: LayoutMode =
        modeRaw === 'sticky' ? 'sticky' : 'freeRoam'; // default freeRoam

      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WidgetConfig[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(
            (w) => VALID_TYPES.has(w.type) && VALID_SIZES.has(w.size),
          );
          if (valid.length > 0) {
            set({ widgets: valid, initialized: true, tutorialSeen, fillRows, layoutMode });
            return;
          }
        }
      }

      // Try migrating from v2 format (gridX/widthSlots)
      const rawV2 = await AsyncStorage.getItem('widget_layout_v2');
      if (rawV2) {
        const parsedV2 = JSON.parse(rawV2) as any[];
        if (Array.isArray(parsedV2) && parsedV2.length > 0) {
          const migrated: WidgetConfig[] = parsedV2
            .filter((w: any) => VALID_TYPES.has(w.type))
            .map((w: any, i: number) => ({
              id: w.id,
              type: w.type as WidgetType,
              size: slotsToSize(w.widthSlots ?? 2),
              order: w.order ?? i,
            }));
          if (migrated.length > 0) {
            set({ widgets: migrated, initialized: true, tutorialSeen, fillRows, layoutMode });
            persistLayout(migrated);
            return;
          }
        }
      }
    } catch {}
    set({ initialized: true });
  },

  toggleEditMode: () => {
    set((s) => ({ editMode: !s.editMode }));
  },

  toggleFillRows: () => {
    const next = !get().fillRows;
    set({ fillRows: next });
    AsyncStorage.setItem(FILL_KEY, String(next));
  },

  setLayoutMode: (mode) => {
    const { widgets, measuredHeights, fillRows, layoutMode } = get();
    if (mode === layoutMode) return;

    if (mode === 'freeRoam') {
      // Compute current flow positions and bake them as freeX/freeY
      const positions = computeFlowLayout(widgets, measuredHeights, fillRows);
      const posMap: Record<string, { x: number; y: number }> = {};
      for (const p of positions) posMap[p.id] = { x: p.x, y: p.y };

      const updated = widgets.map((w) => ({
        ...w,
        freeX: w.freeX ?? posMap[w.id]?.x ?? 0,
        freeY: w.freeY ?? posMap[w.id]?.y ?? 0,
      }));
      set({ layoutMode: mode, widgets: updated });
      persistLayout(updated);
    } else {
      set({ layoutMode: mode });
    }
    AsyncStorage.setItem(LAYOUT_MODE_KEY, mode);
  },

  moveFreeWidget: (id, x, y) => {
    const { widgets } = get();
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, freeX: x, freeY: y } : w,
    );
    set({ widgets: updated });
    persistLayout(updated);
  },

  moveWidget: (id, dropY) => {
    const { widgets, measuredHeights, fillRows } = get();
    const updated = reorderAfterDrop(widgets, id, dropY, measuredHeights, fillRows);
    set({ widgets: updated });
    persistLayout(updated);
  },

  resizeWidget: (id, newSize, customHeight) => {
    const { widgets } = get();
    const updated = widgets.map((w) =>
      w.id === id ? { ...w, size: newSize, customHeight } : w,
    );
    set({ widgets: updated });
    persistLayout(updated);
  },

  cycleSize: (id) => {
    const { widgets } = get();
    const widget = widgets.find((w) => w.id === id);
    if (!widget) return;

    const meta = WIDGET_REGISTRY[widget.type];
    const allowed = meta.allowedSizes;
    const currentIndex = allowed.indexOf(widget.size);
    const nextIndex = (currentIndex + 1) % allowed.length;
    const nextSize = allowed[nextIndex];

    const updated = widgets.map((w) =>
      w.id === id ? { ...w, size: nextSize } : w,
    );
    set({ widgets: updated });
    persistLayout(updated);
  },

  addWidget: (type) => {
    const { widgets } = get();
    const meta = WIDGET_REGISTRY[type];
    const maxOrder = widgets.reduce((max, w) => Math.max(max, w.order), -1);
    const newWidget: WidgetConfig = {
      id: generateId(),
      type,
      size: meta.defaultSize,
      order: maxOrder + 1,
    };
    const updated = [...widgets, newWidget];
    set({ widgets: updated });
    persistLayout(updated);
  },

  removeWidget: (id) => {
    const { widgets, measuredHeights } = get();
    const filtered = widgets.filter((w) => w.id !== id);
    const reordered = filtered
      .sort((a, b) => a.order - b.order)
      .map((w, i) => ({ ...w, order: i }));
    const { [id]: _, ...remainingHeights } = measuredHeights;
    set({ widgets: reordered, measuredHeights: remainingHeights });
    persistLayout(reordered);
  },

  resetToDefault: () => {
    set({ widgets: DEFAULT_LAYOUT, measuredHeights: {} });
    persistLayout(DEFAULT_LAYOUT);
  },

  setMeasuredHeight: (id, height) => {
    const { measuredHeights } = get();
    if (Math.abs((measuredHeights[id] ?? 0) - height) < 1) return;
    set({ measuredHeights: { ...measuredHeights, [id]: height } });
  },

  dismissTutorial: () => {
    set({ tutorialSeen: true });
    AsyncStorage.setItem(TUTORIAL_KEY, 'true');
  },
}));
