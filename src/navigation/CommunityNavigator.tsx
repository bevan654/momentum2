import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FriendsScreen from '../screens/FriendsScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
};

const Stack = createNativeStackNavigator<CommunityStackParamList>();

export default function CommunityNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'ios_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="CommunityHome" component={FriendsScreen} />
    </Stack.Navigator>
  );
}
