import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CreateRoutineScreen from '../screens/CreateRoutineScreen';
import RoutineSummaryScreen from '../screens/RoutineSummaryScreen';
import CreateProgramScreen from '../screens/CreateProgramScreen';
import ProgramSummaryScreen from '../screens/ProgramSummaryScreen';
import ProgramDayEditorScreen from '../screens/ProgramDayEditorScreen';
import ProgramProgressScreen from '../screens/ProgramProgressScreen';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import StartWorkoutScreen from '../screens/StartWorkoutScreen';
import SheetWrapper from '../components/SheetWrapper';
import { useColors } from '../theme/useColors';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';

export type WorkoutsStackParamList = {
  StartWorkout: undefined;
  Plans: undefined;
  CreateRoutine: { routineId?: string } | undefined;
  RoutineSummary: { routineId: string };
  CreateProgram: { programId?: string } | undefined;
  ProgramSummary: { programId: string };
  ProgramProgress: { programId: string };
  ProgramDayEditor: undefined;
  WorkoutDetail: { workoutId: string };
};

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

/* ─── Recovery overlay control (module-level bridge) ── */
let _setRecoveryVisible: ((v: boolean) => void) | null = null;
export function showRecoveryOverlay() { _setRecoveryVisible?.(true); }
export function hideRecoveryOverlay() { _setRecoveryVisible?.(false); }

/* ─── Stack navigation bridge (for navigating from recovery overlay) ── */
let _workoutsNavRef: any = null;
export function navigateWorkoutsStack(screen: string, params?: any) {
  _workoutsNavRef?.navigate(screen, params);
  setTimeout(() => hideRecoveryOverlay(), 50);
}

// Placeholder root — when stack pops back here, show recovery overlay
function StackRoot({ navigation }: any) {
  useEffect(() => {
    _workoutsNavRef = navigation;
    const unsubscribe = navigation.addListener('focus', () => {
      showRecoveryOverlay();
    });
    return unsubscribe;
  }, [navigation]);
  return <View style={{ flex: 1 }} />;
}

/* ─── Sheet wrappers for form screens (no own sheet chrome) ── */
function CreateProgramModal() {
  return <SheetWrapper><CreateProgramScreen /></SheetWrapper>;
}
function CreateRoutineModal() {
  return <SheetWrapper><CreateRoutineScreen /></SheetWrapper>;
}
function ProgramDayEditorModal() {
  return <SheetWrapper><ProgramDayEditorScreen /></SheetWrapper>;
}

/* ─── Backdrop wrappers for screens with own sheet chrome ── */
function RoutineSummaryModal() {
  return <SheetWrapper hasOwnSheet><RoutineSummaryScreen /></SheetWrapper>;
}
function ProgramSummaryModal() {
  return <SheetWrapper hasOwnSheet><ProgramSummaryScreen /></SheetWrapper>;
}
function ProgramProgressModal() {
  return <SheetWrapper hasOwnSheet><ProgramProgressScreen /></SheetWrapper>;
}

export default function WorkoutsNavigator() {
  const colors = useColors();
  const showSummary = useActiveWorkoutStore((s) => s.showSummary);
  const [recoveryVisible, setRecoveryVisible] = useState(true);

  useEffect(() => {
    _setRecoveryVisible = setRecoveryVisible;
    return () => { _setRecoveryVisible = null; };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Recovery — always rendered as base layer (zIndex 0) */}
      {!showSummary && (
        <View
          pointerEvents={recoveryVisible ? 'auto' : 'none'}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 0,
            backgroundColor: colors.background,
          }}
        >
          <WorkoutHistoryScreen />
        </View>
      )}

      {/* Stack — on top (zIndex 1) */}
      <View
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 1,
          opacity: recoveryVisible ? 0 : 1,
        }}
        pointerEvents={recoveryVisible ? 'none' : 'auto'}
      >
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            gestureEnabled: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen
            name="StartWorkout"
            component={StackRoot}
            options={{ animation: 'none', contentStyle: { backgroundColor: 'transparent' } }}
          />

          {/* ── Plans overlay (needs transparency for backdrop) ── */}
          <Stack.Screen
            name="Plans"
            component={StartWorkoutScreen}
            options={{
              presentation: 'transparentModal',
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'none',
            }}
          />

          {/* ── Sub-modals (card presentation for speed) ── */}
          <Stack.Screen
            name="CreateProgram"
            component={CreateProgramModal}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CreateRoutine"
            component={CreateRoutineModal}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ProgramDayEditor"
            component={ProgramDayEditorModal}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="RoutineSummary"
            component={RoutineSummaryModal}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ProgramSummary"
            component={ProgramSummaryModal}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="ProgramProgress"
            component={ProgramProgressModal}
            options={{ animation: 'slide_from_right' }}
          />

          {/* WorkoutDetail keeps its own presentation */}
          <Stack.Screen
            name="WorkoutDetail"
            component={WorkoutDetailScreen}
            options={{ gestureEnabled: false }}
          />
        </Stack.Navigator>
      </View>
    </View>
  );
}
