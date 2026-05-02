import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useActiveWorkoutStore } from '../../stores/useActiveWorkoutStore';
import { useProgramStore } from '../../stores/useProgramStore';
import { useRoutineStore } from '../../stores/useRoutineStore';

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m} MIN`;
}

function QuickStartCard() {
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const showSheet = useActiveWorkoutStore((s) => s.showSheet);
  const startTime = useActiveWorkoutStore((s) => s.startTime);
  const activeProgram = useProgramStore((s) => s.activeProgram);
  const getTodaysRoutine = useProgramStore((s) => s.getTodaysRoutine);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const routines = useRoutineStore((s) => s.routines);
  const navigation = useNavigation<any>();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isActive) showSheet();
    else navigation.navigate('Workouts', { screen: 'StartWorkout' });
  }, [isActive, showSheet, navigation]);

  const elapsed = isActive && startTime ? Math.max(0, Math.floor((Date.now() - startTime) / 1000)) : 0;
  const subtitle = formatElapsed(elapsed);

  // Decide title + meta based on state
  let title: string;
  let meta: string;
  if (isActive) {
    title = 'Resume Workout';
    meta = `Live · ${subtitle}`;
  } else {
    const todayRoutine = activeProgram ? getTodaysRoutine() : null;
    if (todayRoutine && activeProgram) {
      const week = getCurrentWeek();
      title = todayRoutine.label;
      meta = `Today · Week ${week} · ${activeProgram.name}`;
    } else if (activeProgram) {
      title = 'Rest Day';
      meta = activeProgram.name;
    } else if (routines.length > 0) {
      title = 'Start a Workout';
      meta = `Pick from ${routines.length} routine${routines.length === 1 ? '' : 's'}`;
    } else {
      title = 'Start an Empty Workout';
      meta = 'No routines yet';
    }
  }

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress} activeOpacity={0.85}>
      <View style={styles.bodyLeft}>
        <Text style={styles.metaText} numberOfLines={1}>{meta}</Text>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
      </View>
      <View style={styles.playBtn}>
        <Ionicons name="play" size={ms(20)} color={colors.textOnAccent} style={{ marginLeft: sw(2) }} />
      </View>
    </TouchableOpacity>
  );
}

export default React.memo(QuickStartCard);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 0,
    paddingVertical: sw(18),
    paddingHorizontal: sw(18),
    gap: sw(12),
    overflow: 'hidden',
  },
  bodyLeft: {
    flex: 1,
    gap: sw(4),
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(22),
    lineHeight: ms(26),
    fontFamily: Fonts.bold,
    letterSpacing: -0.4,
  },
  playBtn: {
    width: sw(52),
    height: sw(52),
    borderRadius: sw(26),
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
