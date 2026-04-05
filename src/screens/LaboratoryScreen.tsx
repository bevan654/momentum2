import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, sh } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useProfileSettingsStore } from '../stores/useProfileSettingsStore';
import AiHeroCard from '../components/lab/AiHeroCard';
import QuickStatsGrid from '../components/lab/QuickStatsGrid';
import MuscleRadarCard from '../components/lab/MuscleRadarCard';
import WeeklyVolumeCard from '../components/lab/WeeklyVolumeCard';
import BodyMetricsPager from '../components/lab/BodyMetricsPager';
import { onReconnect } from '../stores/useNetworkStore';

export default function LaboratoryScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const initialized = useProfileSettingsStore((s) => s.initialized);
  const [aiExpanded, setAiExpanded] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!initialized) useProfileSettingsStore.getState().loadSettings();
  }, []);

  const loadLabData = useCallback((uid: string) => {
    fetchExerciseCatalog(uid).then(() => fetchWorkoutHistory(uid));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) loadLabData(user.id);
    }, [user?.id])
  );

  // Auto-refresh when coming back online
  useEffect(() => {
    if (!user?.id) return;
    return onReconnect(() => loadLabData(user.id));
  }, [user?.id]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.cardsSection}>
        <View style={styles.heroRow}>
          <AiHeroCard expanded={aiExpanded} onToggle={() => setAiExpanded(!aiExpanded)} />
          {!aiExpanded && <QuickStatsGrid />}
        </View>
        <MuscleRadarCard />
        <WeeklyVolumeCard />
        <BodyMetricsPager />
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
    cardsSection: {
      paddingHorizontal: sw(16),
      gap: sw(12),
      paddingTop: sw(8),
    },
    heroRow: {
      flexDirection: 'row',
      height: sh(340),
      gap: sw(8),
    },
  });
