import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import BottomSheet from '../workout-sheet/BottomSheet';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useWidgetStore } from '../../stores/useWidgetStore';
import { WIDGET_REGISTRY } from './widgetRegistry';
import type { WidgetType, WidgetMeta } from '../../types/widget';

const ALL_WIDGETS = Object.values(WIDGET_REGISTRY);

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddWidgetSheet({ visible, onClose }: Props) {
  const addWidget = useWidgetStore((s) => s.addWidget);
  const widgets = useWidgetStore((s) => s.widgets);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const existingTypes = useMemo(
    () => new Set(widgets.map((w) => w.type)),
    [widgets],
  );

  const handleAdd = (type: WidgetType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addWidget(type);
    onClose();
  };

  const renderItem = ({ item }: { item: WidgetMeta }) => {
    const alreadyAdded = existingTypes.has(item.type);

    return (
      <TouchableOpacity
        style={[styles.item, alreadyAdded && styles.itemDisabled]}
        onPress={() => handleAdd(item.type)}
        disabled={alreadyAdded}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.accent + '20' }]}>
          <Ionicons
            name={item.icon as any}
            size={ms(22)}
            color={alreadyAdded ? colors.textTertiary : colors.accent}
          />
        </View>
        <View style={styles.itemText}>
          <Text style={[styles.itemLabel, alreadyAdded && { color: colors.textTertiary }]}>
            {item.label}
          </Text>
          <Text style={styles.itemSize}>
            Default: {item.defaultSize}
          </Text>
        </View>
        {alreadyAdded ? (
          <Ionicons name="checkmark-circle" size={ms(20)} color={colors.textTertiary} />
        ) : (
          <Ionicons name="add-circle-outline" size={ms(20)} color={colors.accent} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} height="50%">
      <View style={styles.container}>
        <Text style={styles.title}>Add Widget</Text>
        <FlatList
          data={ALL_WIDGETS}
          keyExtractor={(item) => item.type}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: sw(16),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    marginBottom: sw(16),
    textAlign: 'center',
  },
  list: {
    gap: sw(8),
    paddingBottom: sw(20),
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    padding: sw(14),
    gap: sw(12),
  },
  itemDisabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: sw(42),
    height: sw(42),
    borderRadius: sw(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemLabel: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  itemSize: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
    marginTop: sw(2),
  },
});
