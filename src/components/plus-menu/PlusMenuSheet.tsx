import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../../theme/responsive';
import * as Haptics from 'expo-haptics';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import BottomSheet from '../workout-sheet/BottomSheet';

const SHEET_HEIGHT = sw(420);
const GREEN = '#34D399';
const ORANGE = '#F59E0B';
const WATER_BLUE = '#60A5FA';
const CREATINE_YELLOW = '#FBBF24';

const PADDING = sw(20);
const GAP = sw(12);
const TILE_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP) / 2;

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function PlusMenuSheet({ visible, onClose }: Props) {
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleLogWorkout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    if (isActive) {
      showSheet();
    } else {
      startWorkout();
    }
  };

  const handleLogFood = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleQuickLog = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={SHEET_HEIGHT}
      backdropOpacityValue={0.6}
      bgColor={colors.card}
      radius={sw(24)}
      handleWidth={sw(36)}
    >
      <View style={styles.content}>
        {/* Large action cards */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: GREEN }]}
            onPress={handleLogWorkout}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="barbell-outline" size={ms(28)} color={colors.textOnAccent} />
            </View>
            <Text style={styles.actionLabel}>
              {isActive ? 'Resume Workout' : 'Log Workout'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: ORANGE }]}
            onPress={handleLogFood}
            activeOpacity={0.8}
          >
            <View style={styles.actionIconWrap}>
              <Ionicons name="nutrition-outline" size={ms(28)} color={colors.textOnAccent} />
            </View>
            <Text style={styles.actionLabel}>Log Food</Text>
          </TouchableOpacity>
        </View>

        {/* Quick-log grid */}
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={[styles.quickTile, { width: TILE_WIDTH }]}
            onPress={handleQuickLog}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIcon, { backgroundColor: colors.accent + '20' }]}>
              <Ionicons name="scale-outline" size={ms(18)} color={colors.accent} />
            </View>
            <Text style={styles.quickLabel}>Weight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickTile, { width: TILE_WIDTH }]}
            onPress={handleQuickLog}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIcon, { backgroundColor: WATER_BLUE + '20' }]}>
              <Ionicons name="water-outline" size={ms(18)} color={WATER_BLUE} />
            </View>
            <Text style={styles.quickLabel}>Water</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickTile, { width: TILE_WIDTH }]}
            onPress={handleQuickLog}
            activeOpacity={0.7}
          >
            <View style={[styles.quickIcon, { backgroundColor: CREATINE_YELLOW + '20' }]}>
              <Ionicons name="flash-outline" size={ms(18)} color={CREATINE_YELLOW} />
            </View>
            <Text style={styles.quickLabel}>Creatine</Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: {
    paddingHorizontal: PADDING,
    paddingBottom: sw(40),
  },

  /* Action cards */
  actionRow: {
    flexDirection: 'row',
    gap: GAP,
    marginBottom: sw(16),
  },
  actionCard: {
    flex: 1,
    height: sw(120),
    borderRadius: sw(16),
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(10),
  },
  actionIconWrap: {
    width: sw(48),
    height: sw(48),
    borderRadius: sw(24),
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.bold,
  },

  /* Quick-log grid */
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  quickTile: {
    backgroundColor: colors.surface,
    borderRadius: sw(12),
    paddingVertical: sw(14),
    paddingHorizontal: sw(14),
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  quickIcon: {
    width: sw(34),
    height: sw(34),
    borderRadius: sw(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickLabel: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.semiBold,
  },
});
