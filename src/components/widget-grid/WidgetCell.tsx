import React, { useEffect, useCallback, useMemo, memo } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  runOnJS,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import type { WidgetConfig, WidgetPosition, WidgetSize, LayoutMode } from '../../types/widget';
import { sw } from '../../theme/responsive';
import {
  colsToSize,
  SLOT_WIDTH,
  GRID_GAP,
  GRID_COLUMNS,
  SNAP_HEIGHT,
} from './gridConstants';
import { useColors } from '../../theme/useColors';
import { useWidgetStore } from '../../stores/useWidgetStore';
import WidgetRemoveButton from './WidgetRemoveButton';
import ResizeGrip from './WidgetResizeHandle';

// Widget content components
import NutritionCard from '../home/NutritionCard';
import WaterCard from '../home/WaterCard';
import CreatineCard from '../home/CreatineCard';
import ActivityCard from '../home/ActivityCard';
import LogWorkoutWidget from './LogWorkoutWidget';
import LogFoodWidget from './LogFoodWidget';

const SPRING_CONFIG = { damping: 20, stiffness: 200 };
const HANDLE_HIT = sw(40); // Hit-test area for the resize handle

const WIDGET_COMPONENTS: Record<string, React.ComponentType<{ size: WidgetSize }>> = {
  nutrition: NutritionCard,
  water: WaterCard,
  creatine: CreatineCard,
  activity: ActivityCard,
  logWorkout: LogWorkoutWidget,
  logFood: LogFoodWidget,
};

interface WidgetCellProps {
  widget: WidgetConfig;
  position: WidgetPosition;
  editMode: boolean;
  layoutMode: LayoutMode;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default memo(function WidgetCell({
  widget,
  position,
  editMode,
  layoutMode,
  onDragStart,
  onDragEnd,
}: WidgetCellProps) {
  const moveWidget = useWidgetStore((s) => s.moveWidget);
  const moveFreeWidget = useWidgetStore((s) => s.moveFreeWidget);
  const resizeWidget = useWidgetStore((s) => s.resizeWidget);
  const removeWidget = useWidgetStore((s) => s.removeWidget);
  const setMeasuredHeight = useWidgetStore((s) => s.setMeasuredHeight);
  const colors = useColors();

  // Effective size: based on actual rendered columns (includes stretch)
  const effectiveSize = colsToSize(position.cols);

  // ── Shared values ───────────────────────────────────────────────
  const animX = useSharedValue(position.x);
  const animY = useSharedValue(position.y);
  const animW = useSharedValue(position.width);
  const animH = useSharedValue(position.height);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const resizeDW = useSharedValue(0);
  const resizeDH = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(1);
  const rotation = useSharedValue(0);
  const isFreeSV = useSharedValue(layoutMode === 'freeRoam' ? 1 : 0);
  const isResizing = useSharedValue(0); // 0 = dragging, 1 = resizing
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);
  const lastSnapCols = useSharedValue(0);
  const lastSnapHUnits = useSharedValue(0);

  // ── Sync reactive props to shared values ────────────────────────
  useEffect(() => {
    isFreeSV.value = layoutMode === 'freeRoam' ? 1 : 0;
  }, [layoutMode]);

  useEffect(() => {
    animX.value = withSpring(position.x, SPRING_CONFIG);
    animY.value = withSpring(position.y, SPRING_CONFIG);
    animW.value = withSpring(position.width, SPRING_CONFIG);
    animH.value = withSpring(position.height, SPRING_CONFIG);
  }, [position.x, position.y, position.width, position.height]);

  // Jiggle in edit mode
  useEffect(() => {
    if (editMode) {
      const delay = Math.random() * 100;
      const timer = setTimeout(() => {
        rotation.value = withRepeat(
          withSequence(
            withTiming(-1, { duration: 80 }),
            withTiming(1, { duration: 80 }),
          ),
          -1,
          true,
        );
      }, delay);
      return () => clearTimeout(timer);
    } else {
      rotation.value = withTiming(0, { duration: 100 });
    }
  }, [editMode]);

  // Measure natural content height
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) {
      setMeasuredHeight(widget.id, height);
    }
  }, [widget.id, setMeasuredHeight]);

  // ── Haptics ─────────────────────────────────────────────────────
  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };
  const triggerSnapHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // ── Drag callbacks ──────────────────────────────────────────────
  const handleStickyDragEnd = useCallback((pixelY: number) => {
    moveWidget(widget.id, pixelY);
    onDragEnd?.();
  }, [widget.id, moveWidget, onDragEnd]);

  const handleFreeDragEnd = useCallback((newX: number, newY: number) => {
    moveFreeWidget(widget.id, Math.max(0, newX), Math.max(0, newY));
    onDragEnd?.();
  }, [widget.id, moveFreeWidget, onDragEnd]);

  // ── Resize callback ─────────────────────────────────────────────
  const handleResizeEnd = useCallback((cols: number, height: number) => {
    const newSize = colsToSize(cols);
    resizeWidget(widget.id, newSize, height);
    onDragEnd?.();
  }, [widget.id, resizeWidget, onDragEnd]);

  // ── Single Pan gesture — detects drag vs resize by touch start position
  const gesture = Gesture.Pan()
    .enabled(editMode)
    .onStart((e) => {
      'worklet';
      // Detect if touch landed on the resize handle (bottom-right corner)
      const inHandle =
        e.x > animW.value - HANDLE_HIT && e.y > animH.value - HANDLE_HIT;
      isResizing.value = inHandle ? 1 : 0;

      zIndex.value = 100;

      if (inHandle) {
        startW.value = animW.value;
        startH.value = animH.value;
        // Seed snap trackers for haptic detection
        const currentCols = Math.round(
          (animW.value + GRID_GAP) / (SLOT_WIDTH + GRID_GAP),
        );
        lastSnapCols.value = currentCols;
        lastSnapHUnits.value = Math.round(animH.value / SNAP_HEIGHT);
      } else {
        scale.value = withSpring(1.05, SPRING_CONFIG);
      }

      runOnJS(triggerHaptic)();
      if (onDragStart) runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      'worklet';
      if (isResizing.value === 1) {
        // ── Resize with snap ──────────────────────────────────
        const rawW = startW.value + e.translationX;
        const rawH = startH.value + e.translationY;

        // Snap width to column grid
        const snappedCols = Math.max(
          1,
          Math.min(
            GRID_COLUMNS,
            Math.round((rawW + GRID_GAP) / (SLOT_WIDTH + GRID_GAP)),
          ),
        );
        const snappedW =
          snappedCols * SLOT_WIDTH + (snappedCols - 1) * GRID_GAP;

        // Snap height to grid unit
        const snappedHUnits = Math.max(1, Math.round(rawH / SNAP_HEIGHT));
        const snappedH = snappedHUnits * SNAP_HEIGHT;

        resizeDW.value = snappedW - animW.value;
        resizeDH.value = snappedH - animH.value;

        // Haptic on each snap transition
        if (
          snappedCols !== lastSnapCols.value ||
          snappedHUnits !== lastSnapHUnits.value
        ) {
          lastSnapCols.value = snappedCols;
          lastSnapHUnits.value = snappedHUnits;
          runOnJS(triggerSnapHaptic)();
        }
      } else {
        // ── Drag ──────────────────────────────────────────────
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      }
    })
    .onEnd(() => {
      'worklet';
      if (isResizing.value === 1) {
        // ── Resize end: commit snapped dimensions ─────────────
        const finalW = animW.value + resizeDW.value;
        const finalH = animH.value + resizeDH.value;

        const newCols = Math.max(
          1,
          Math.min(
            GRID_COLUMNS,
            Math.round((finalW + GRID_GAP) / (SLOT_WIDTH + GRID_GAP)),
          ),
        );
        const newH = Math.max(SNAP_HEIGHT, finalH);

        // Animate to final snapped size
        animW.value = withSpring(
          newCols * SLOT_WIDTH + (newCols - 1) * GRID_GAP,
          SPRING_CONFIG,
        );
        animH.value = withSpring(newH, SPRING_CONFIG);
        resizeDW.value = 0;
        resizeDH.value = 0;
        zIndex.value = 1;

        runOnJS(handleResizeEnd)(newCols, newH);
      } else if (isFreeSV.value === 1) {
        // ── Free roam drag end ────────────────────────────────
        const newX = animX.value + translateX.value;
        const newY = animY.value + translateY.value;
        animX.value = Math.max(0, newX);
        animY.value = Math.max(0, newY);
        translateX.value = 0;
        translateY.value = 0;
        scale.value = withSpring(1, SPRING_CONFIG);
        zIndex.value = 1;
        runOnJS(handleFreeDragEnd)(newX, newY);
      } else {
        // ── Sticky drag end ───────────────────────────────────
        const newPixelY = animY.value + translateY.value;
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        scale.value = withSpring(1, SPRING_CONFIG);
        zIndex.value = 1;
        runOnJS(handleStickyDragEnd)(newPixelY);
      }
      isResizing.value = 0;
    });

  // ── Animated styles ─────────────────────────────────────────────
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: animX.value + translateX.value },
      { translateY: animY.value + translateY.value },
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    width: animW.value + resizeDW.value,
    height: animH.value + resizeDH.value,
    zIndex: zIndex.value,
  }));

  const cardStyle = useMemo(() => ({
    flex: 1 as const,
    backgroundColor: colors.card,
    borderRadius: sw(16),
    overflow: 'hidden' as const,
  }), [colors.card]);

  const ContentComponent = WIDGET_COMPONENTS[widget.type];

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cell, animatedStyle]}>
        <View style={cardStyle}>
          <View onLayout={handleLayout}>
            {ContentComponent && <ContentComponent size={effectiveSize} />}
          </View>
        </View>
        {editMode && (
          <>
            <WidgetRemoveButton onRemove={() => removeWidget(widget.id)} />
            <Animated.View
              style={styles.resizeHandleWrap}
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(150)}
            >
              <ResizeGrip />
            </Animated.View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  cell: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  resizeHandleWrap: {
    position: 'absolute',
    bottom: sw(4),
    right: sw(4),
    zIndex: 10,
  },
});
