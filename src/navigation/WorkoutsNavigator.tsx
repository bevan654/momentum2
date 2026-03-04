import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import StartWorkoutScreen from '../screens/StartWorkoutScreen';
import CreateRoutineScreen from '../screens/CreateRoutineScreen';
import RoutineSummaryScreen from '../screens/RoutineSummaryScreen';

export type WorkoutsStackParamList = {
  WorkoutHistory: undefined;
  StartWorkout: undefined;
  CreateRoutine: { routineId?: string } | undefined;
  RoutineSummary: { routineId: string };
};

const Stack = createNativeStackNavigator<WorkoutsStackParamList>();

export default function WorkoutsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="StartWorkout" component={StartWorkoutScreen} />
      <Stack.Screen name="CreateRoutine" component={CreateRoutineScreen} />
      <Stack.Screen name="RoutineSummary" component={RoutineSummaryScreen} />
    </Stack.Navigator>
  );
}
