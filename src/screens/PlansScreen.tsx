import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, Alert } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms, SCREEN_HEIGHT } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useProgramStore } from '../stores/useProgramStore';
import RoutineCard from '../components/workouts/RoutineCard';
import ProgramCard from '../components/workouts/ProgramCard';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';
import { confirmReplaceWorkout } from '../utils/confirmReplaceWorkout';

const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;

export default function PlansScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id);
  const routines = useRoutineStore((s) => s.routines);
  const fetchRoutines = useRoutineStore((s) => s.fetchRoutines);
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const programs = useProgramStore((s) => s.programs);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const startProgram = useProgramStore((s) => s.startProgram);
  const abandonProgram = useProgramStore((s) => s.abandonProgram);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const colors = useColors();
  const sheetMarginTop = SCREEN_HEIGHT * 0.08;
  const sheetTravel = SCREEN_HEIGHT;
  const styles = useMemo(() => createStyles(colors, sheetMarginTop), [colors, sheetMarginTop]);

  const translateY = useSharedValue(sheetTravel);
  const backdropOpacity = useSharedValue(0);
  const ctx = useSharedValue(0);
  const dismissing = useRef(false);

  useEffect(() => {
    translateY.value = 0;
    backdropOpacity.value = 1;
  }, []);

  useEffect(() => {
    if (userId) {
      fetchRoutines(userId);
      fetchPrograms(userId);
    }
  }, [userId]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);

  const openProgram = useCallback((programId: string) => navigation.navigate('ProgramSummary', { programId }), [navigation]);
  const reviewProgram = useCallback((programId: string) => navigation.navigate('ProgramProgress', { programId }), [navigation]);
  const handleStartProgram = useCallback(async (programId: string) => {
    const { error } = await startProgram(programId);
    if (error) Alert.alert('Error', error);
  }, [startProgram]);

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    translateY.value = sheetTravel;
    backdropOpacity.value = 0;
    goBack();
  }, [goBack, sheetTravel]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(8)
        .onStart(() => {
          ctx.value = translateY.value;
        })
        .onUpdate((e) => {
          translateY.value = Math.max(0, ctx.value + e.translationY);
        })
        .onEnd((e) => {
          if (
            e.translationY > DISMISS_THRESHOLD ||
            e.velocityY > VELOCITY_THRESHOLD
          ) {
            translateY.value = sheetTravel;
            backdropOpacity.value = 0;
            runOnJS(goBack)();
          } else {
            translateY.value = 0;
          }
        }),
    [goBack, sheetTravel],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={styles.handleRow}>
            <View style={styles.handle} />
          </Animated.View>
        </GestureDetector>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* My Programs */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Programs</Text>
            <TouchableOpacity
              style={styles.newRoutineBtn}
              onPress={() => navigation.navigate('CreateProgram')}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={ms(16)} color={colors.accent} />
              <Text style={styles.newRoutineText}>New</Text>
            </TouchableOpacity>
          </View>

          {programs.length === 0 ? (
            <View style={styles.emptyRoutines}>
              <Text style={styles.emptyText}>No programs yet</Text>
              <Text style={styles.emptySubtext}>Create a multi-week training plan</Text>
            </View>
          ) : (
            programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                week={program.status === 'active' ? getCurrentWeek() : 0}
                onOpen={openProgram}
                onReview={reviewProgram}
                onDelete={deleteProgram}
                onAbandon={abandonProgram}
                onStart={handleStartProgram}
              />
            ))
          )}

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
                onPress={() => navigation.navigate('RoutineSummary', { routineId: routine.id })}
                onPlay={() => {
                  // Dismiss the Plans transparent-modal stack first — iOS rejects
                  // presenting ActiveWorkoutSheet's Modal while another modal is on top.
                  confirmReplaceWorkout(() => {
                    dismiss();
                    setTimeout(() => startFromRoutine(routine, catalogMap, prevMap), 350);
                  });
                }}
                onDelete={async () => {
                  const { error } = await deleteRoutine(routine.id);
                  if (error) Alert.alert('Error', error);
                }}
              />
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors: ThemeColors, sheetMarginTop: number) => StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.backdrop + '80',
  },
  sheet: {
    flex: 1,
    marginTop: sheetMarginTop,
    backgroundColor: colors.background,
    borderTopLeftRadius: sw(20),
    borderTopRightRadius: sw(20),
    overflow: 'hidden' as const,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: sw(12),
    paddingBottom: sw(12),
  },
  handle: {
    width: sw(36),
    height: sw(4),
    borderRadius: sw(2),
    backgroundColor: colors.textTertiary,
    opacity: 0.4,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: sw(16),
    paddingBottom: sw(40),
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
    borderRadius: 0,
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
});
