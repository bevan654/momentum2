import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWidgetStore } from '../../stores/useWidgetStore';
import { computeFlowLayout, computeFreeLayout, getGridHeight } from './gridLayout';
import WidgetCell from './WidgetCell';
import AddWidgetSheet from './AddWidgetSheet';
import TutorialOverlay from './TutorialOverlay';

export default function WidgetGrid() {
  const widgets = useWidgetStore((s) => s.widgets);
  const editMode = useWidgetStore((s) => s.editMode);
  const toggleEditMode = useWidgetStore((s) => s.toggleEditMode);
  const loadLayout = useWidgetStore((s) => s.loadLayout);
  const initialized = useWidgetStore((s) => s.initialized);
  const measuredHeights = useWidgetStore((s) => s.measuredHeights);
  const tutorialSeen = useWidgetStore((s) => s.tutorialSeen);
  const fillRows = useWidgetStore((s) => s.fillRows);
  const toggleFillRows = useWidgetStore((s) => s.toggleFillRows);
  const layoutMode = useWidgetStore((s) => s.layoutMode);
  const setLayoutMode = useWidgetStore((s) => s.setLayoutMode);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isDragging, setIsDragging] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  // Load persisted layout on mount
  useEffect(() => {
    if (!initialized) loadLayout();
  }, [initialized]);

  // Exit edit mode on tab switch
  useFocusEffect(
    useCallback(() => {
      return () => {
        const state = useWidgetStore.getState();
        if (state.editMode) state.toggleEditMode();
      };
    }, []),
  );

  // Compute positions based on layout mode
  const positions = useMemo(
    () =>
      layoutMode === 'freeRoam'
        ? computeFreeLayout(widgets, measuredHeights)
        : computeFlowLayout(widgets, measuredHeights, fillRows),
    [widgets, measuredHeights, fillRows, layoutMode],
  );

  const positionMap = useMemo(() => {
    const map: Record<string, (typeof positions)[number]> = {};
    for (const p of positions) map[p.id] = p;
    return map;
  }, [positions]);

  const containerHeight = useMemo(() => getGridHeight(positions), [positions]);

  const handleToggleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleEditMode();
  };

  const handleToggleFill = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFillRows();
  };

  const handleSetMode = (mode: 'freeRoam' | 'sticky') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLayoutMode(mode);
  };

  const handleAddPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowAddSheet(true);
  };

  return (
    <View style={styles.wrapper}>
      {/* Header toolbar */}
      <View style={styles.header}>
        {editMode && (
          <View style={styles.modeRow}>
            {/* Layout mode toggle */}
            <View style={styles.modePills}>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  layoutMode === 'freeRoam' && { backgroundColor: colors.accent + '18' },
                ]}
                onPress={() => handleSetMode('freeRoam')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="move-outline"
                  size={ms(13)}
                  color={layoutMode === 'freeRoam' ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modePillText,
                    layoutMode === 'freeRoam' && { color: colors.accent },
                  ]}
                >
                  Free
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modePill,
                  layoutMode === 'sticky' && { backgroundColor: colors.accent + '18' },
                ]}
                onPress={() => handleSetMode('sticky')}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="apps-outline"
                  size={ms(13)}
                  color={layoutMode === 'sticky' ? colors.accent : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modePillText,
                    layoutMode === 'sticky' && { color: colors.accent },
                  ]}
                >
                  Grid
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fill/Fixed toggle — only in sticky mode */}
            {layoutMode === 'sticky' && (
              <TouchableOpacity
                style={[styles.fillToggle, fillRows && { backgroundColor: colors.accent + '18' }]}
                onPress={handleToggleFill}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={fillRows ? 'grid' : 'grid-outline'}
                  size={ms(14)}
                  color={fillRows ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.fillToggleText, fillRows && { color: colors.accent }]}>
                  {fillRows ? 'Fill' : 'Fixed'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={styles.headerSpacer} />

        <TouchableOpacity onPress={handleToggleEdit} activeOpacity={0.7}>
          <Text style={[styles.editButton, editMode && { color: colors.accent }]}>
            {editMode ? 'Done' : 'Customize'}
          </Text>
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        scrollEnabled={!isDragging}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.gridContainer, { height: containerHeight }]}>
          {widgets.map((widget) => {
            const pos = positionMap[widget.id];
            if (!pos) return null;
            return (
              <WidgetCell
                key={widget.id}
                widget={widget}
                position={pos}
                editMode={editMode}
                layoutMode={layoutMode}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={() => setIsDragging(false)}
              />
            );
          })}
        </View>
      </Animated.ScrollView>

      {/* FAB for adding widgets */}
      {editMode && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.accent }]}
          onPress={handleAddPress}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={ms(24)} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <AddWidgetSheet
        visible={showAddSheet}
        onClose={() => setShowAddSheet(false)}
      />

      {!tutorialSeen && <TutorialOverlay />}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: sw(8),
  },
  headerSpacer: {
    flex: 1,
  },
  editButton: {
    color: colors.textSecondary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  modePills: {
    flexDirection: 'row',
    borderRadius: sw(8),
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    paddingVertical: sw(5),
    paddingHorizontal: sw(10),
  },
  modePillText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  fillToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
    paddingVertical: sw(5),
    paddingHorizontal: sw(10),
    borderRadius: sw(8),
    backgroundColor: colors.surface,
  },
  fillToggleText: {
    color: colors.textSecondary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.semiBold,
  },
  scrollContent: {
    paddingBottom: sw(20),
  },
  gridContainer: {
    position: 'relative',
  },
  fab: {
    position: 'absolute',
    bottom: sw(20),
    right: 0,
    width: sw(48),
    height: sw(48),
    borderRadius: sw(24),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
