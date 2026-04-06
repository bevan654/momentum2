import React, { useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useProfileSettingsStore } from '../stores/useProfileSettingsStore';
import AiHeroCard from '../components/lab/AiHeroCard';
import MuscleRadarCard from '../components/lab/MuscleRadarCard';
import WeeklyVolumeCard from '../components/lab/WeeklyVolumeCard';
import BodyMetricsPager from '../components/lab/BodyMetricsPager';

export default function LaboratoryScreen() {
  const user = useAuthStore((s) => s.user);
  const fetchWorkoutHistory = useWorkoutStore((s) => s.fetchWorkoutHistory);
  const fetchExerciseCatalog = useWorkoutStore((s) => s.fetchExerciseCatalog);
  const initialized = useProfileSettingsStore((s) => s.initialized);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (!initialized) useProfileSettingsStore.getState().loadSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        fetchExerciseCatalog(user.id).then(() => {
          fetchWorkoutHistory(user.id);
        });
      }
    }, [user?.id])
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.cardsSection}>
        <AiHeroCard />
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
  });
