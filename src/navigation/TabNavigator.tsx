import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import type { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { Fonts } from '../theme/typography';
import { sw, ms, SCREEN_WIDTH } from '../theme/responsive';
import Header from '../components/home/Header';
import HomeScreen from '../screens/HomeScreen';
import FoodLoggerScreen from '../screens/FoodLoggerScreen';
import FriendsScreen from '../screens/FriendsScreen';
import LaboratoryScreen from '../screens/LaboratoryScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useFriendsStore } from '../stores/useFriendsStore';
import WorkoutsNavigator from './WorkoutsNavigator';
import ActiveWorkoutSheet from '../components/workout-sheet/ActiveWorkoutSheet';
import FriendProfileModal from '../components/friends/FriendProfileModal';
import FloatingWorkoutBanner from '../components/workout-sheet/FloatingWorkoutBanner';
import BottomSheet from '../components/workout-sheet/BottomSheet';
import { useAuthStore } from '../stores/useAuthStore';
import { useActiveWorkoutStore } from '../stores/useActiveWorkoutStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useRankStore } from '../stores/useRankStore';
import { initNotifications, cleanupNotifications } from '../services/notificationService';

const Tab = createMaterialTopTabNavigator();

/* ─── Profile sheet trigger (called from HomeScreen avatar) ── */
let _openProfileSheet: (() => void) | null = null;
let _profileInitialSection: string | null = null;
export function openProfileSheet() {
  _profileInitialSection = null;
  _openProfileSheet?.();
}
export function openProfileToSection(section: string) {
  _profileInitialSection = section;
  _openProfileSheet?.();
}
export function consumeProfileInitialSection(): string | null {
  const s = _profileInitialSection;
  _profileInitialSection = null;
  return s;
}

/* ─── Tab config ────────────────────────────────────────── */

const TAB_ICONS: Record<string, string> = {
  Recovery: 'pulse-outline',
  Workouts: 'barbell-outline',
  Home: 'home',
  Nutrition: 'nutrition-outline',
  Community: 'people-outline',
};

const TAB_COUNT = 5;
const HOME_INDEX = 2; // center slot
const HOME_BTN = sw(46);
const BADGE_SIZE = sw(16);
const ICON_SIZE = ms(24);
const HOME_ICON_SIZE = ms(22);
const TAB_WIDTH = SCREEN_WIDTH / TAB_COUNT;
const INDICATOR_W = sw(28);
const INDICATOR_H = sw(3);

/* ─── Animated tab icon ─────────────────────────────────── */

const AnimatedTabIcon = memo(function AnimatedTabIcon({
  index,
  position,
  iconName,
  isFriends,
  isHome,
  colors,
  unreadCount,
}: {
  index: number;
  position: Animated.AnimatedInterpolation<number>;
  iconName: string;
  isFriends: boolean;
  isHome: boolean;
  colors: ThemeColors;
  unreadCount: number;
}) {
  const scale = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [1, 1.15, 1],
    extrapolate: 'clamp',
  });

  // Cross-fade: active (white) icon fades in over the inactive (gray) icon
  const activeOpacity = position.interpolate({
    inputRange: [index - 1, index, index + 1],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  const homeButtonStyle = useMemo(() => {
    if (!isHome) return null;
    return {
      width: HOME_BTN,
      height: HOME_BTN,
      borderRadius: HOME_BTN / 2,
      backgroundColor: colors.accent,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginBottom: sw(2),
    };
  }, [isHome, colors.accent]);

  const badge = useMemo(() => {
    if (!isFriends || unreadCount <= 0) return null;
    return {
      badge: {
        position: 'absolute' as const,
        top: -sw(4),
        right: -sw(8),
        backgroundColor: colors.accentRed,
        borderRadius: BADGE_SIZE / 2,
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
      },
      text: {
        color: colors.textOnAccent,
        fontSize: ms(10),
        lineHeight: ms(14),
        fontFamily: Fonts.bold,
      },
    };
  }, [isFriends, unreadCount, colors.accentRed, colors.textOnAccent]);

  if (isHome) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={homeButtonStyle}>
          <Ionicons name={iconName as any} size={HOME_ICON_SIZE} color={colors.textOnAccent} />
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {/* Base: inactive gray icon (always visible) */}
      <Ionicons name={iconName as any} size={ICON_SIZE} color={colors.tabInactive} />
      {/* Overlay: active white icon fades in */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: activeOpacity }]}>
        <Ionicons name={iconName as any} size={ICON_SIZE} color={colors.textPrimary} />
      </Animated.View>
      {badge && (
        <View style={badge.badge}>
          <Text style={badge.text}>
            {unreadCount > 99 ? '99+' : String(unreadCount)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
});

/* ─── Custom bottom tab bar ─────────────────────────────── */

function BottomTabBar({
  state,
  navigation,
  position,
  onOpenProfile,
  onTabChange,
}: MaterialTopTabBarProps & { onOpenProfile: () => void; onTabChange: (name: string) => void }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const unreadCount = useFriendsStore((s) => s.unreadCount);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    onTabChange(state.routes[state.index].name);
  }, [state.index]);

  const translateX = position.interpolate({
    inputRange: state.routes.map((_, i) => i),
    outputRange: state.routes.map((_, i) => i * TAB_WIDTH + (TAB_WIDTH - INDICATOR_W) / 2),
  });

  return (
    <View>
      <FloatingWorkoutBanner />
      <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
        {/* Sliding indicator pill */}
        <Animated.View
          style={[
            styles.indicator,
            { transform: [{ translateX }] },
          ]}
        />

        {/* Tab items */}
        {state.routes.map((route, index) => {
          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (state.index !== index && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = route.name === 'Home' ? () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onOpenProfile();
          } : undefined;

          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tabItem}
              onPress={onPress}
              onLongPress={onLongPress}
              delayLongPress={400}
              activeOpacity={0.7}
            >
              <AnimatedTabIcon
                index={index}
                position={position}
                iconName={TAB_ICONS[route.name] || 'ellipse'}
                isFriends={route.name === 'Community'}
                isHome={route.name === 'Home'}
                colors={colors}
                unreadCount={unreadCount}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/* ─── Main navigator ────────────────────────────────────── */

export default function TabNavigator() {
  const userId = useAuthStore((s) => s.user?.id);
  const [profileVisible, setProfileVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('Home');
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (userId) {
      useActiveWorkoutStore.getState().restoreWorkout();
      useWorkoutStore.getState().fetchExerciseCatalog(userId);
      useWorkoutStore.getState().fetchPrevData(userId);
      useRankStore.getState().loadRank(userId);
      useRankStore.getState().computeRank(userId);
      initNotifications(userId);
    }
    return () => {
      cleanupNotifications();
    };
  }, [userId]);

  const openProfile = useCallback(() => setProfileVisible(true), []);
  const closeProfile = useCallback(() => setProfileVisible(false), []);

  // Expose for external callers (e.g. HomeScreen avatar)
  useEffect(() => {
    _openProfileSheet = openProfile;
    return () => { _openProfileSheet = null; };
  }, [openProfile]);
  const renderTabBar = useCallback(
    (props: MaterialTopTabBarProps) => <BottomTabBar {...props} onOpenProfile={openProfile} onTabChange={setActiveTab} />,
    [openProfile]
  );

  return (
    <View style={styles.root}>
      <Header />
      <Tab.Navigator
        tabBar={renderTabBar}
        tabBarPosition="bottom"
        initialRouteName="Home"
        initialLayout={{ width: SCREEN_WIDTH }}
        screenOptions={{
          swipeEnabled: true,
          animationEnabled: true,
          lazy: true,
          freezeOnBlur: true,
        }}
      >
        <Tab.Screen name="Recovery" component={LaboratoryScreen} />
        <Tab.Screen name="Workouts" component={WorkoutsNavigator} />
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Nutrition" component={FoodLoggerScreen} />
        <Tab.Screen name="Community" component={FriendsScreen} />
      </Tab.Navigator>
      <BottomSheet visible={profileVisible} onClose={closeProfile} height="92%" modal>
        <ProfileScreen onClose={closeProfile} />
      </BottomSheet>
      <ActiveWorkoutSheet />
      <FriendProfileModal />
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderTopColor: colors.cardBorder,
    borderTopWidth: 0.5,
    paddingTop: sw(8),
    shadowColor: colors.cardShadow.shadowColor,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: colors.cardShadow.shadowOpacity,
    shadowRadius: colors.cardShadow.shadowRadius,
    elevation: colors.cardShadow.elevation,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sw(6),
  },

  /* Sliding indicator */
  indicator: {
    position: 'absolute',
    top: 0,
    width: INDICATOR_W,
    height: INDICATOR_H,
    borderRadius: INDICATOR_H / 2,
    backgroundColor: colors.textPrimary,
  },

  /* Home button */
  homeButton: {
    width: HOME_BTN,
    height: HOME_BTN,
    borderRadius: HOME_BTN / 2,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: sw(2),
  },
});
