import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { useChatStore } from '../../stores/useChatStore';
import type { CommunityStackParamList } from '../../navigation/CommunityNavigator';
import type { FriendProfile } from '../../lib/friendsDatabase';
import FriendAvatarBar from './FriendAvatarBar';
import FriendSearch from './FriendSearch';
import NudgeModal from './NudgeModal';
import NotificationList from './NotificationList';
import ActivityFeed from './ActivityFeed';

type OverlayMode = 'none' | 'search' | 'notifications';

type Nav = NativeStackNavigationProp<CommunityStackParamList>;

export default function FriendsTab() {
  const navigation = useNavigation<Nav>();
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [nudgeTarget, setNudgeTarget] = useState<FriendProfile | null>(null);
  const showProfileSheet = useFriendsStore((s) => s.showProfileSheet);
  const totalUnreadMessages = useChatStore((s) => s.totalUnreadCount);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const overlayOpacity = useSharedValue(0);

  const userId = useAuthStore((s) => s.user?.id);
  const unreadCount = useFriendsStore((s) => s.unreadCount);
  const fetchUnreadCount = useFriendsStore((s) => s.fetchUnreadCount);
  const fetchFriends = useFriendsStore((s) => s.fetchFriends);

  useEffect(() => {
    if (userId) {
      fetchUnreadCount(userId);
      fetchFriends(userId);
    }
  }, [userId]);

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  /* ─── Overlay switching (search / notifications) ────── */

  const switchOverlay = useCallback(
    (mode: OverlayMode) => {
      const next = overlayMode === mode ? 'none' : mode;
      setOverlayMode(next);
      overlayOpacity.value = withTiming(next !== 'none' ? 1 : 0, { duration: 150 });
    },
    [overlayMode],
  );

  /* ─── Animated styles ───────────────────────────────── */

  const overlayLayerStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  /* ─── Handlers ──────────────────────────────────────── */

  const handleOpenProfile = useCallback(
    (friend: FriendProfile) => {
      showProfileSheet(friend);
    },
    [showProfileSheet],
  );

  const handleOpenSearch = useCallback(() => {
    switchOverlay('search');
  }, [switchOverlay]);

  const isSearchActive = overlayMode === 'search';
  const isNotifActive = overlayMode === 'notifications';

  return (
    <View style={styles.container}>
      {/* ── Header ──────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Community</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.navigate('ChatList')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="paper-plane-outline"
              size={ms(19)}
              color={colors.textPrimary}
            />
            {totalUnreadMessages > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {totalUnreadMessages > 99 ? '99+' : String(totalUnreadMessages)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, isSearchActive && styles.headerBtnActive]}
            onPress={() => switchOverlay('search')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="search-outline"
              size={ms(20)}
              color={isSearchActive ? colors.textOnAccent : colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerBtn, isNotifActive && styles.headerBtnActive]}
            onPress={() => switchOverlay('notifications')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="notifications-outline"
              size={ms(20)}
              color={isNotifActive ? colors.textOnAccent : colors.textPrimary}
            />
            {unreadCount > 0 && !isNotifActive && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeText}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body ────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Avatar bar + Feed (default view) */}
        <FriendAvatarBar
          onOpenProfile={handleOpenProfile}
          onOpenSearch={handleOpenSearch}
        />
        <View style={styles.feedArea}>
          <ActivityFeed />
        </View>

        {/* Search overlay */}
        {overlayMode === 'search' && (
          <Animated.View style={[styles.overlayLayer, overlayLayerStyle]}>
            <FriendSearch />
          </Animated.View>
        )}

        {/* Notifications overlay */}
        {overlayMode === 'notifications' && (
          <Animated.View style={[styles.overlayLayer, overlayLayerStyle]}>
            <NotificationList />
          </Animated.View>
        )}
      </View>

      {nudgeTarget && (
        <NudgeModal
          friend={nudgeTarget}
          onClose={() => setNudgeTarget(null)}
        />
      )}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    /* Header */
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
      paddingBottom: sw(10),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(22),
      fontFamily: Fonts.bold,
      lineHeight: ms(27),
      letterSpacing: -0.3,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
    },
    headerBtn: {
      width: sw(38),
      height: sw(38),
      borderRadius: sw(12),
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      borderWidth: 0.5,
      borderColor: colors.cardBorder,
    },
    headerBtnActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    badge: {
      position: 'absolute',
      top: -sw(2),
      right: -sw(2),
      backgroundColor: colors.accentRed,
      borderRadius: sw(10),
      minWidth: sw(18),
      height: sw(18),
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sw(4),
      borderWidth: 2,
      borderColor: colors.background,
    },
    badgeText: {
      color: colors.textOnAccent,
      fontSize: ms(9),
      fontFamily: Fonts.bold,
      lineHeight: ms(12),
    },

    /* Body */
    body: {
      flex: 1,
    },
    feedArea: {
      flex: 1,
    },

    /* Overlays */
    overlayLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
    },
  });
