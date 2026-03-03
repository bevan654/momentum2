import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import StartWorkoutScreen from '../screens/StartWorkoutScreen';
import CreateRoutineScreen from '../screens/CreateRoutineScreen';

export type WorkoutsStackParamList = {
  WorkoutHistory: undefined;
  StartWorkout: undefined;
  CreateRoutine: undefined;
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
    </Stack.Navigator>
  );
}
