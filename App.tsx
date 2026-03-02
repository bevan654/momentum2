import React, { useEffect, useMemo } from 'react';
import { ActivityIndicator, Platform, View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from './src/stores/useAuthStore';
import { useThemeStore } from './src/stores/useThemeStore';
import { useAppUpdates } from './src/hooks/useAppUpdates';
import { useChangelogStore } from './src/stores/useChangelogStore';
import TabNavigator from './src/navigation/TabNavigator';
import AuthNavigator from './src/navigation/AuthNavigator';
import OnboardingScreen from './src/screens/OnboardingScreen';
import WelcomeSplashScreen from './src/screens/WelcomeSplashScreen';
import ChangelogModal from './src/components/home/ChangelogModal';
import { Fonts } from './src/theme/typography';
import { getThemeColors } from './src/theme/useColors';

// Foreground handler — show notifications as banners
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type as string | undefined;
    const isRestTimer = type === 'rest_complete';
    const isWorkoutTicker = type === 'workout_active';

    return {
      shouldShowAlert: !isWorkoutTicker,
      shouldPlaySound: isRestTimer,
      shouldSetBadge: false,
      shouldShowBanner: !isRestTimer && !isWorkoutTicker,
      shouldShowList: isWorkoutTicker,
    };
  },
});

// Android notification channels
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
  Notifications.setNotificationChannelAsync('social', {
    name: 'Social',
    description: 'Friend requests, reactions, live workout invites',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: 'default',
  });
  // Clean up stale workout channels from previous builds
  Notifications.deleteNotificationChannelAsync('workout').catch(() => {});
  Notifications.deleteNotificationChannelAsync('workout_silent').catch(() => {});
}

export default function App() {
  const { session, profile, initialized, initialize, showWelcome } = useAuthStore();
  const mode = useThemeStore((s) => s.mode);
  const accentColor = useThemeStore((s) => s.accentColor);
  const themeReady = useThemeStore((s) => s.initialized);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  // EAS Updates — change to 'prompt' to show restart alert, or 'silent' for background
  useAppUpdates('silent');

  const colors = useMemo(() => getThemeColors(mode, accentColor), [mode, accentColor]);

  const navTheme = useMemo(
    () => ({
      dark: mode !== 'light',
      colors: {
        primary: colors.accent,
        background: colors.background,
        card: colors.background,
        text: colors.textPrimary,
        border: colors.cardBorder,
        notification: colors.accentRed,
      },
      fonts: {
        regular: { fontFamily: Fonts.regular, fontWeight: '400' as const },
        medium: { fontFamily: Fonts.medium, fontWeight: '500' as const },
        bold: { fontFamily: Fonts.bold, fontWeight: '700' as const },
        heavy: { fontFamily: Fonts.extraBold, fontWeight: '800' as const },
      },
    }),
    [colors, mode],
  );

  useEffect(() => {
    initialize();
    useThemeStore.getState().loadTheme();
    useChangelogStore.getState().check();
  }, []);

  if (!fontsLoaded || !initialized || !themeReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <NavigationContainer theme={navTheme}>
          <StatusBar style={mode === 'light' ? 'dark' : 'light'} />
          {session
            ? showWelcome
              ? <WelcomeSplashScreen />
              : !profile
                ? <View style={[styles.loading, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.accent} />
                  </View>
                : (profile.height != null
                    && profile.age != null
                    && profile.gender != null
                    && profile.starting_weight != null
                  ? <>
                      <TabNavigator />
                      <ChangelogModal />
                    </>
                  : <OnboardingScreen />)
            : <AuthNavigator />
          }
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
