import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import FriendsScreen from '../screens/FriendsScreen';
import ChatListScreen from '../components/chat/ChatListScreen';
import ChatScreen from '../components/chat/ChatScreen';

export type CommunityStackParamList = {
  CommunityHome: undefined;
  ChatList: undefined;
  Chat: { conversationId: string; friendId: string; friendName: string };
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
      <Stack.Screen name="ChatList" component={ChatListScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}
