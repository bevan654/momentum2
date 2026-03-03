import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import type { WorkoutWithDetails } from '../stores/useWorkoutStore';
import RoutineCard from '../components/workouts/RoutineCard';
import WorkoutSummaryModal from '../components/workout-sheet/WorkoutSummaryModal';

type WorkoutsStackParamList = {
  WorkoutHistory: undefined;
  StartWorkout: undefined;
  CreateRoutine: undefined;
};

export default function StartWorkoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id);
  const routines = useRoutineStore((s) => s.routines);
  const fetchRoutines = useRoutineStore((s) => s.fetchRoutines);
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const workouts = useWorkoutStore((s) => s.workouts);
  const deleteWorkout = useWorkoutStore((s) => s.deleteWorkout);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedWorkout, setSelectedWorkout] = useState<WorkoutWithDetails | null>(null);

  useEffect(() => {
    if (userId) fetchRoutines(userId);
  }, [userId]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.navigate('WorkoutHistory')} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={ms(24)} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Start Workout</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Start Empty Workout */}
        <TouchableOpacity
          style={styles.actionCard}
          activeOpacity={0.7}
          onPress={() => {
            startWorkout();
            navigation.goBack();
          }}
        >
          <View style={styles.actionIcon}>
            <Ionicons name="flash" size={ms(22)} color={colors.accentOrange} />
          </View>
          <View style={styles.actionText}>
            <Text style={styles.actionTitle}>Start Empty Workout</Text>
            <Text style={styles.actionSub}>Begin with a blank session</Text>
          </View>
          <Ionicons name="chevron-forward" size={ms(20)} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* My Routines */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Routines</Text>
          <TouchableOpacity
            style={styles.newRoutineBtn}
            onPress={() => navigation.navigate('CreateRoutine')}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={ms(16)} color={colors.accent} />
            <Text style={styles.newRoutineText}>New</Text>
          </TouchableOpacity>
        </View>

        {routines.length === 0 ? (
          <View style={styles.emptyRoutines}>
            <Text style={styles.emptyText}>No routines yet</Text>
            <Text style={styles.emptySubtext}>Create one to get started</Text>
          </View>
        ) : (
          routines.map((routine) => (
            <RoutineCard
              key={routine.id}
              routine={routine}
              onPlay={() => {
                startFromRoutine(routine, catalogMap, prevMap);
                navigation.goBack();
              }}
              onDelete={async () => {
                const { error } = await deleteRoutine(routine.id);
                if (error) Alert.alert('Error', error);
              }}
            />
          ))
        )}

        {/* Recent Sessions */}
        {workouts.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Sessions</Text>
            </View>
            {workouts.slice(0, 5).map((w) => {
              const d = new Date(w.created_at);
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
              const dateStr = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
              const durationMin = Math.round(w.duration / 60);
              const vol = w.totalVolume >= 1000 ? `${(w.totalVolume / 1000).toFixed(1)}k` : `${w.totalVolume}`;
              return (
                <TouchableOpacity
                  key={w.id}
                  style={styles.recentRow}
                  activeOpacity={0.6}
                  onPress={() => setSelectedWorkout(w)}
                >
                  <View style={styles.recentRowLeft}>
                    <Text style={styles.recentDate}>{dateStr}</Text>
                    <Text style={styles.recentMeta}>
                      {w.exercises.length} exercise{w.exercises.length !== 1 ? 's' : ''}
                      {'  ·  '}{durationMin} min
                    </Text>
                  </View>
                  <View style={styles.recentRowRight}>
                    <Text style={styles.recentVolume}>{vol}</Text>
                    <Text style={styles.recentVolUnit}>kg</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={ms(14)} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      {selectedWorkout && (
        <WorkoutSummaryModal
          mode="historical"
          data={selectedWorkout}
          onDismiss={() => setSelectedWorkout(null)}
          onDelete={async () => {
            const id = selectedWorkout.id;
            setSelectedWorkout(null);
            await deleteWorkout(id);
          }}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(16),
    paddingVertical: sw(12),
  },
  backBtn: {
    width: sw(36),
    height: sw(36),
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(40),
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: sw(14),
    padding: sw(16),
    marginBottom: sw(10),
    gap: sw(14),
  },
  actionIcon: {
    width: sw(44),
    height: sw(44),
    borderRadius: sw(12),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    flex: 1,
    gap: sw(2),
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.semiBold,
  },
  actionSub: {
    color: colors.textTertiary,
    fontSize: ms(12),
    lineHeight: ms(16),
    fontFamily: Fonts.medium,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: sw(20),
    marginBottom: sw(14),
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
  },
  newRoutineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
  },
  newRoutineText: {
    color: colors.accent,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.semiBold,
  },
  emptyRoutines: {
    backgroundColor: colors.card,
    borderRadius: sw(14),
    paddingVertical: sw(30),
    alignItems: 'center',
    gap: sw(6),
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    lineHeight: ms(21),
    fontFamily: Fonts.semiBold,
  },
  emptySubtext: {
    color: colors.textTertiary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.medium,
  },

  /* ── Recent Sessions ───────────────────────────── */
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sw(10),
    borderBottomWidth: 0.5,
    borderBottomColor: colors.cardBorder,
  },
  recentRowLeft: {
    flex: 1,
    gap: sw(2),
  },
  recentDate: {
    color: colors.textPrimary,
    fontSize: ms(13),
    lineHeight: ms(18),
    fontFamily: Fonts.semiBold,
  },
  recentMeta: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(15),
    fontFamily: Fonts.medium,
  },
  recentRowRight: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sw(2),
    marginRight: sw(8),
  },
  recentVolume: {
    color: colors.textPrimary,
    fontSize: ms(14),
    lineHeight: ms(20),
    fontFamily: Fonts.extraBold,
    letterSpacing: -0.3,
  },
  recentVolUnit: {
    color: colors.textTertiary,
    fontSize: ms(10),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
});
