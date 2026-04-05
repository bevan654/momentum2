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

import {
  setRecoveryOverlayControl,
  setWorkoutsNavRef,
  showRecoveryOverlay,
} from '../lib/navigationBridge';

// Placeholder root — when stack pops back here, show recovery overlay
function StackRoot({ navigation }: any) {
  const colors = useColors();
  useEffect(() => {
    setWorkoutsNavRef(navigation);
    const unsubscribe = navigation.addListener('focus', () => {
      showRecoveryOverlay();
    });
    return unsubscribe;
  }, [navigation]);
  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
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
    setRecoveryOverlayControl(setRecoveryVisible);
    return () => { setRecoveryOverlayControl(null); };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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

          {/* ── Sub-modals (transparent so SheetWrapper backdrop shows through) ── */}
          <Stack.Screen
            name="CreateProgram"
            component={CreateProgramModal}
            options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="CreateRoutine"
            component={CreateRoutineModal}
            options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="ProgramDayEditor"
            component={ProgramDayEditorModal}
            options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="RoutineSummary"
            component={RoutineSummaryModal}
            options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="ProgramSummary"
            component={ProgramSummaryModal}
            options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
          />
          <Stack.Screen
            name="ProgramProgress"
            component={ProgramProgressModal}
            options={{ presentation: 'transparentModal', animation: 'slide_from_right', contentStyle: { backgroundColor: 'transparent' } }}
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
