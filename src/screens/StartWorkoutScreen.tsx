import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, StyleSheet, Alert, Pressable, Animated as RNAnimated } from 'react-native';
import { Swipeable, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms, SCREEN_HEIGHT } from '../theme/responsive';
import { useAuthStore } from '../stores/useAuthStore';
import { useRoutineStore } from '../stores/useRoutineStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useProgramStore } from '../stores/useProgramStore';
import RoutineCard from '../components/workouts/RoutineCard';
import type { WorkoutsStackParamList } from '../navigation/WorkoutsNavigator';

const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 800;

export default function StartWorkoutScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<WorkoutsStackParamList>>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id);
  const routines = useRoutineStore((s) => s.routines);
  const fetchRoutines = useRoutineStore((s) => s.fetchRoutines);
  const deleteRoutine = useRoutineStore((s) => s.deleteRoutine);
  const startFromRoutine = useActiveWorkoutStore((s) => s.startFromRoutine);
  const catalogMap = useWorkoutStore((s) => s.catalogMap);
  const prevMap = useWorkoutStore((s) => s.prevMap);
  const programs = useProgramStore((s) => s.programs);
  const activeProgram = useProgramStore((s) => s.activeProgram);
  const fetchPrograms = useProgramStore((s) => s.fetchPrograms);
  const deleteProgram = useProgramStore((s) => s.deleteProgram);
  const startProgram = useProgramStore((s) => s.startProgram);
  const abandonProgram = useProgramStore((s) => s.abandonProgram);
  const getCurrentWeek = useProgramStore((s) => s.getCurrentWeek);
  const colors = useColors();
  const sheetMarginTop = insets.top + sw(10);
  const sheetTravel = SCREEN_HEIGHT;
  const styles = useMemo(() => createStyles(colors, sheetMarginTop), [colors, sheetMarginTop]);

  const translateY = useSharedValue(sheetTravel);
  const backdropOpacity = useSharedValue(0);
  const ctx = useSharedValue(0);
  const dismissing = useRef(false);

  useEffect(() => {
    translateY.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.8 });
    backdropOpacity.value = withTiming(1, { duration: 250 });
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

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    translateY.value = withSpring(sheetTravel, { damping: 28, stiffness: 280, mass: 0.8 });
    backdropOpacity.value = withTiming(0, { duration: 250 }, () => {
      runOnJS(goBack)();
    });
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
            translateY.value = withSpring(sheetTravel, { damping: 28, stiffness: 280, mass: 0.8 });
            backdropOpacity.value = withTiming(0, { duration: 250 }, () => {
              runOnJS(goBack)();
            });
          } else {
            translateY.value = withSpring(0, { damping: 28, stiffness: 280, mass: 0.8 });
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

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
            programs.map((program) => {
              const isActive = program.status === 'active';
              const week = isActive ? getCurrentWeek() : 0;
              return (
                <View key={program.id} style={styles.swipeContainer}>
                  <Swipeable
                    overshootRight={false}
                    friction={2}
                    rightThreshold={40}
                    renderRightActions={(progress) => {
                      const trans = progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [sw(80), 0],
                        extrapolate: 'clamp',
                      });
                      return (
                        <RNAnimated.View style={[styles.deleteAction, { transform: [{ translateX: trans }] }]}>
                          <TouchableOpacity
                            style={styles.deleteActionInner}
                            onPress={() => deleteProgram(program.id)}
                            activeOpacity={0.7}
                          >
                            <Ionicons name="trash" size={ms(22)} color="#fff" />
                            <Text style={styles.deleteActionText}>Delete</Text>
                          </TouchableOpacity>
                        </RNAnimated.View>
                      );
                    }}
                  >
                    <View style={styles.programCard}>
                      <Pressable
                        style={({ pressed }) => [styles.programInfo, pressed && { opacity: 0.7 }]}
                        onPress={() => navigation.navigate('ProgramSummary', { programId: program.id })}
                      >
                        <View style={styles.programNameRow}>
                          <Text style={styles.programCardName} numberOfLines={1}>{program.name}</Text>
                          {isActive && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>
                                ACTIVE{program.end_date ? ` · till ${(() => {
                                  const d = new Date(program.end_date);
                                  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                                  return `${months[d.getMonth()]} ${d.getDate()}`;
                                })()}` : ''}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.programCardMeta}>
                          {program.days.length} days/week
                          {(() => {
                            const dw = useProgramStore.getState().getDurationWeeks(program);
                            return dw > 0 ? ` · ${dw} weeks` : '';
                          })()}
                          {isActive ? ` · Week ${week}` : ''}
                        </Text>
                        <View style={styles.programDayDots}>
                          {DAYS.map((day, i) => {
                            const hasDay = program.days.some((d) => d.day_of_week === i);
                            return (
                              <View
                                key={i}
                                style={[styles.programDot, hasDay && styles.programDotFilled]}
                              >
                                <Text style={[styles.programDotText, hasDay && styles.programDotTextFilled]}>
                                  {day[0]}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                        {isActive && (
                          <TouchableOpacity
                            style={styles.progressBtn}
                            activeOpacity={0.7}
                            onPress={() => navigation.navigate('ProgramProgress', { programId: program.id })}
                          >
                            <Ionicons name="stats-chart" size={ms(12)} color={colors.accent} />
                            <Text style={styles.progressBtnText}>REVIEW PROGRESS</Text>
                          </TouchableOpacity>
                        )}
                      </Pressable>
                      {isActive ? (
                        <TouchableOpacity
                          style={[styles.programCardStatus, { backgroundColor: colors.surface }]}
                          activeOpacity={0.7}
                          onPress={() => {
                            Alert.alert('Abandon Program', `Stop "${program.name}"? This cannot be undone.`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Abandon', style: 'destructive', onPress: () => abandonProgram(program.id) },
                            ]);
                          }}
                        >
                          <Text style={styles.abortText}>ABORT</Text>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.programCardStatus}
                          onPress={async () => {
                            const { error } = await startProgram(program.id);
                            if (error) Alert.alert('Error', error);
                          }}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="play" size={ms(18)} color={colors.textOnAccent} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </Swipeable>
                </View>
              );
            })
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
                  startFromRoutine(routine, catalogMap, prevMap);
                  dismiss();
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
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  swipeContainer: {
    overflow: 'hidden',
    marginBottom: sw(10),
  },
  deleteAction: {
    width: sw(80),
  },
  deleteActionInner: {
    flex: 1,
    backgroundColor: colors.accentRed,
    justifyContent: 'center',
    alignItems: 'center',
    gap: sw(4),
  },
  deleteActionText: {
    color: '#fff',
    fontSize: ms(12),
    fontFamily: Fonts.semiBold,
  },
  programCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 0,
  },
  programInfo: {
    flex: 1,
    gap: sw(2),
    padding: sw(14),
  },
  programNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(8),
  },
  programCardName: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.bold,
    lineHeight: ms(18),
    flexShrink: 1,
  },
  programCardMeta: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  programDayDots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: sw(4),
    marginTop: sw(4),
  },
  programDot: {
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  programDotFilled: {
    backgroundColor: colors.accent + '18',
  },
  programDotText: {
    color: colors.textTertiary,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  programDotTextFilled: {
    color: colors.accent,
  },
  progressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: sw(4),
    marginTop: sw(6),
    paddingVertical: sw(4),
    paddingHorizontal: sw(8),
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '10',
  },
  progressBtnText: {
    color: colors.accent,
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  programCardStatus: {
    justifyContent: 'center',
    alignItems: 'center',
    width: sw(44),
    alignSelf: 'stretch',
    backgroundColor: colors.accent,
  },
  activeBadge: {
    backgroundColor: '#34C75920',
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
  },
  activeBadgeText: {
    color: '#34C759',
    fontSize: ms(9),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  abortText: {
    color: colors.textTertiary,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});
