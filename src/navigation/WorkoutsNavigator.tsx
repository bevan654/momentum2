import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import StartWorkoutScreen from '../screens/StartWorkoutScreen';
import CreateRoutineScreen from '../screens/CreateRoutineScreen';

export type WorkoutsStackParamList = {
  WorkoutHistory: undefined;
  StartWorkout: undefined;
  CreateRoutine: undefined;
};

const Stack = createStackNavigator<WorkoutsStackParamList>();

export default function WorkoutsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
      }}
    >
      <Stack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <Stack.Screen name="StartWorkout" component={StartWorkoutScreen} />
      <Stack.Screen name="CreateRoutine" component={CreateRoutineScreen} />
    </Stack.Navigator>
  );
}
