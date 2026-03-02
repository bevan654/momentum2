export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

export type WidgetType =
  | 'nutrition'
  | 'water'
  | 'creatine'
  | 'activity'
  | 'logWorkout'
  | 'logFood';

export type LayoutMode = 'freeRoam' | 'sticky';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  size: WidgetSize;
  order: number;
  freeX?: number;
  freeY?: number;
  /** Custom height set by resize gesture (pixels, snapped to grid) */
  customHeight?: number;
}

export interface WidgetMeta {
  type: WidgetType;
  label: string;
  icon: string;
  defaultSize: WidgetSize;
  defaultHeight: number;
  allowedSizes: WidgetSize[];
}

export interface WidgetPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Actual rendered column count (includes stretch) */
  cols: number;
}
