import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Switch, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, ms, SCREEN_HEIGHT } from '../theme/responsive';
import { Fonts } from '../theme/typography';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useMuscleAnalysisStore } from '../stores/useMuscleAnalysisStore';
import { useProfileSettingsStore } from '../stores/useProfileSettingsStore';
import MuscleHeatmap from '../components/body/MuscleHeatmap';
import SummaryStatsCard from '../components/lab/SummaryStatsCard';
import WeeklyVolumeCard from '../components/lab/WeeklyVolumeCard';
import WeightCard from '../components/lab/WeightCard';
import MeasurementsCard from '../components/lab/MeasurementsCard';
import BodyFatCard from '../components/lab/BodyFatCard';

import type { ExerciseWithSets } from '../stores/useWorkoutStore';

const HEATMAP_HEIGHT = SCREEN_HEIGHT * 0.52;

const TRACKER_COMPONENTS: Record<string, React.ComponentType> = {
  weight: WeightCard,
  measurements: MeasurementsCard,
  body_fat: BodyFatCard,
};

export default function LaboratoryScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const workouts = useWorkoutStore((s) => s.workouts);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const recompute = useMuscleAnalysisStore((s) => s.recompute);
  const analysis = useMuscleAnalysisStore((s) => s.analysis);
  const showRankLabels = useProfileSettingsStore((s) => s.showRankLabels);
  const setShowRankLabels = useProfileSettingsStore((s) => s.setShowRankLabels);
  const labTrackers = useProfileSettingsStore((s) => s.labTrackers);
  const initialized = useProfileSettingsStore((s) => s.initialized);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsHeight = useSharedValue(0);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const toggleSettings = useCallback(() => {
    const next = !settingsOpen;
    setSettingsOpen(next);
    settingsHeight.value = withTiming(next ? 1 : 0, { duration: 200 });
  }, [settingsOpen]);

  const settingsMaxH = sw(120);
  const settingsAnimStyle = useAnimatedStyle(() => ({
    maxHeight: settingsHeight.value * settingsMaxH,
    opacity: settingsHeight.value,
  }));

  useEffect(() => {
    if (!initialized) useProfileSettingsStore.getState().loadSettings();
  }, []);

  // Chain catalog before workouts so exercises have muscle data populated
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchExerciseCatalog(user.id).then(() => {
          fetchWorkoutHistory(user.id);
        });
      }
    }, [user?.id])
  );

  useEffect(() => {
    if (workouts.length > 0 && Object.keys(catalogMap).length > 0) {
      recompute(workouts, catalogMap);
    }
  }, [workouts, catalogMap]);

  const thisWeekExercises = useMemo<ExerciseWithSets[]>(() => {
    if (!analysis) return [];
    const exercises: ExerciseWithSets[] = [];
    const seen = new Set<string>();
    for (const w of workouts) {
      const t = new Date(w.created_at).getTime();
      if (t < new Date(analysis.weekStart).getTime() || t > new Date(analysis.weekEnd).getTime())
        continue;
      for (const ex of w.exercises) {
        const key = `${ex.name}|${w.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          exercises.push(ex);
        }
      }
    }
    return exercises;
  }, [analysis, workouts]);

  const sortedTrackers = useMemo(
    () => [...labTrackers].sort((a, b) => a.order - b.order).filter((t) => t.enabled),
    [labTrackers],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Settings gear */}
      <View style={styles.gearRow}>
        <Pressable onPress={toggleSettings} hitSlop={12}>
          <Ionicons
            name={settingsOpen ? 'settings' : 'settings-outline'}
            size={ms(20)}
            color={settingsOpen ? colors.accent : colors.textTertiary}
          />
        </Pressable>
      </View>

      {/* Collapsible settings panel */}
      <Animated.View style={[styles.settingsPanel, settingsAnimStyle]}>
        <View style={styles.settingsCard}>
          <View style={styles.settingsRow}>
            <Text style={styles.settingsLabel}>Show rank labels</Text>
            <Switch
              value={showRankLabels}
              onValueChange={setShowRankLabels}
              trackColor={{ false: colors.cardBorder, true: colors.accentGreen }}
              thumbColor={colors.textOnAccent}
            />
          </View>
        </View>
      </Animated.View>

      <MuscleHeatmap exercises={thisWeekExercises} fillHeight={HEATMAP_HEIGHT} />

      <View style={styles.cardsSection}>
        <SummaryStatsCard analysis={analysis} />
        {sortedTrackers.map((tracker) => {
          const Component = TRACKER_COMPONENTS[tracker.id];
          return Component ? <Component key={tracker.id} /> : null;
        })}
        <WeeklyVolumeCard analysis={analysis} />
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    contentContainer: {
      paddingBottom: sw(24),
    },
    gearRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: sw(18),
      paddingTop: sw(10),
    },
    settingsPanel: {
      overflow: 'hidden',
      marginHorizontal: sw(16),
    },
    settingsCard: {
      backgroundColor: colors.card,
      borderRadius: sw(12),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: sw(16),
      ...colors.cardShadow,
    },
    settingsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: sw(10),
    },
    settingsDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.cardBorder,
    },
    settingsLabel: {
      color: colors.textPrimary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
    },
    cardsSection: {
      paddingHorizontal: sw(16),
      gap: sw(12),
      paddingTop: sw(8),
    },
  });
