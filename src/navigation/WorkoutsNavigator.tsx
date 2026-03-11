import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import StartWorkoutScreen from '../screens/StartWorkoutScreen';
import CreateRoutineScreen from '../screens/CreateRoutineScreen';
import RoutineSummaryScreen from '../screens/RoutineSummaryScreen';
import CreateProgramScreen from '../screens/CreateProgramScreen';
import ProgramSummaryScreen from '../screens/ProgramSummaryScreen';
import ProgramDayEditorScreen from '../screens/ProgramDayEditorScreen';
import ProgramProgressScreen from '../screens/ProgramProgressScreen';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import { useColors } from '../theme/useColors';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';

export type WorkoutsStackParamList = {
  StartWorkout: undefined;
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
let _onPlansShow: (() => void) | null = null;
export function setOnPlansShow(cb: (() => void) | null) { _onPlansShow = cb; }
export function showRecoveryOverlay() { _setRecoveryVisible?.(true); }
export function hideRecoveryOverlay() { _setRecoveryVisible?.(false); _onPlansShow?.(); }

/* ─── Stack navigation bridge (for navigating from recovery overlay) ── */
let _workoutsNavRef: any = null;
export function setWorkoutsNavRef(nav: any) { _workoutsNavRef = nav; }
export function navigateWorkoutsStack(screen: string, params?: any) {
  _workoutsNavRef?.navigate(screen, params);
  setTimeout(() => hideRecoveryOverlay(), 50);
}

export default function WorkoutsNavigator() {
  const colors = useColors();
  const showSummary = useActiveWorkoutStore((s) => s.showSummary);
  const [recoveryVisible, setRecoveryVisible] = useState(true);

  // Expose for external callers
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

      {/* Plans stack — on top (zIndex 1), transparent bg so recovery shows through during drag */}
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
            animation: 'ios_from_right',
            gestureEnabled: true,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        >
          <Stack.Screen name="StartWorkout" component={StartWorkoutScreen} />
          <Stack.Screen name="CreateRoutine" component={CreateRoutineScreen} />
          <Stack.Screen name="CreateProgram" component={CreateProgramScreen} />
          <Stack.Screen name="ProgramDayEditor" component={ProgramDayEditorScreen} />
          <Stack.Screen
            name="WorkoutDetail"
            component={WorkoutDetailScreen}
            options={{
              animation: 'slide_from_bottom',
              gestureEnabled: false,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
          <Stack.Screen
            name="RoutineSummary"
            component={RoutineSummaryScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="ProgramProgress"
            component={ProgramProgressScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
            }}
          />
          <Stack.Screen
            name="ProgramSummary"
            component={ProgramSummaryScreen}
            options={{
              presentation: 'transparentModal',
              animation: 'slide_from_bottom',
              gestureEnabled: true,
            }}
          />
        </Stack.Navigator>
      </View>
    </View>
  );
}
