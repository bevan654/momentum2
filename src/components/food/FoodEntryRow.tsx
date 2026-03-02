import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FoodEntry } from '../../stores/useFoodLogStore';

interface Props {
  entry: FoodEntry;
  onPress: (entry: FoodEntry) => void;
  onTogglePlanned: (id: string) => void;
}

function FoodEntryRow({ entry, onPress, onTogglePlanned }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(entry);
  }, [entry, onPress]);

  const handleToggle = useCallback(() => {
    onTogglePlanned(entry.id);
  }, [entry.id, onTogglePlanned]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.row}
      activeOpacity={0.6}
    >
      <View style={styles.leftCol}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.name}
          </Text>
          {entry.is_planned && (
            <TouchableOpacity onPress={handleToggle} activeOpacity={0.6}>
              <View style={styles.plannedTag}>
                <Text style={styles.plannedTagText}>PLANNED</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.macroRow}>
          <Text style={styles.macroText}>
            P {Math.round(entry.protein)}g
          </Text>
          <View style={styles.dot} />
          <Text style={styles.macroText}>
            C {Math.round(entry.carbs)}g
          </Text>
          <View style={styles.dot} />
          <Text style={styles.macroText}>
            F {Math.round(entry.fat)}g
          </Text>
        </View>
      </View>
      <Text style={styles.calText}>{Math.round(entry.calories)}</Text>
    </TouchableOpacity>
  );
}

export default React.memo(FoodEntryRow);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  leftCol: {
    flex: 1,
    gap: sw(2),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  name: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(17),
    fontFamily: Fonts.semiBold,
  },
  plannedTag: {
    backgroundColor: colors.accentGreen + '18',
    borderRadius: sw(4),
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
  },
  plannedTagText: {
    color: colors.accentGreen,
    fontSize: ms(8),
    lineHeight: ms(11),
    fontFamily: Fonts.extraBold,
    letterSpacing: 0.3,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  macroText: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  dot: {
    width: sw(2.5),
    height: sw(2.5),
    borderRadius: sw(1.5),
    backgroundColor: colors.textTertiary,
    opacity: 0.4,
  },
  calText: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(18),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
  },
});
