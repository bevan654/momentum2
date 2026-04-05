import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { FriendProfile } from '../../lib/friendsDatabase';
import { Ionicons } from '@expo/vector-icons';
import FriendAvatarBar from './FriendAvatarBar';
import AddFriendSheet from './AddFriendSheet';
import NudgeModal from './NudgeModal';
import NotificationList from './NotificationList';
import ActivityFeed from './ActivityFeed';
import { useNetworkStore } from '../../stores/useNetworkStore';

type OverlayMode = 'none' | 'notifications';

export default function FriendsTab() {
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [searchVisible, setSearchVisible] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<FriendProfile | null>(null);
  const showProfileSheet = useFriendsStore((s) => s.showProfileSheet);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const overlayOpacity = useSharedValue(0);

  const userId = useAuthStore((s) => s.user?.id);
  const isOffline = useNetworkStore((s) => s.isOffline);
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

  /* ─── Overlay switching (notifications) ────────────── */

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
    setSearchVisible(true);
  }, []);

  const handleCloseSearch = useCallback(() => {
    setSearchVisible(false);
  }, []);

  const isNotifActive = overlayMode === 'notifications';

  const feedMode = useFriendsStore((s) => s.feedMode);
  const setFeedMode = useFriendsStore((s) => s.setFeedMode);

  return (
    <View style={styles.container}>

      {/* ── Body ────────────────────────────────────────── */}
      <View style={styles.body}>
        {/* Avatar bar */}
        <FriendAvatarBar
          onOpenProfile={handleOpenProfile}
          onOpenSearch={handleOpenSearch}
        />

        {/* ── Feed Mode Tabs ─────────────────────────────── */}
        <View style={styles.feedTabs}>
          {(['global', 'friends'] as const).map((tab) => {
            const label = tab === 'global' ? 'Feed' : 'Friends';
            const isActive = feedMode === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.feedTab, isActive && styles.feedTabActive]}
                onPress={() => setFeedMode(tab)}
                activeOpacity={0.7}
              >
                <Text style={[styles.feedTabText, isActive && styles.feedTabTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.feedArea}>
          {isOffline ? (
            <View style={styles.offlineState}>
              <Ionicons name="cloud-offline-outline" size={ms(32)} color={colors.textTertiary} />
              <Text style={styles.offlineTitle}>No Connection</Text>
              <Text style={styles.offlineSubtext}>Feed and social features need a connection</Text>
            </View>
          ) : (
            <ActivityFeed />
          )}
        </View>

        {/* Notifications overlay */}
        {overlayMode === 'notifications' && !isOffline && (
          <Animated.View style={[styles.overlayLayer, overlayLayerStyle]}>
            <NotificationList />
          </Animated.View>
        )}
      </View>

      {/* Add friend bottom sheet */}
      <AddFriendSheet visible={searchVisible} onClose={handleCloseSearch} />

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

    /* Feed Mode Tabs */
    feedTabs: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      marginTop: sw(18),
    },
    feedTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: sw(10),
      borderBottomWidth: sw(2.5),
      borderBottomColor: 'transparent',
    },
    feedTabActive: {
      borderBottomColor: colors.accent,
    },
    feedTabText: {
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
      color: colors.textTertiary,
    },
    feedTabTextActive: {
      color: colors.textPrimary,
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

    /* Offline */
    offlineState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      paddingBottom: sw(60),
    },
    offlineTitle: {
      color: colors.textSecondary,
      fontSize: ms(16),
      fontFamily: Fonts.semiBold,
    },
    offlineSubtext: {
      color: colors.textTertiary,
      fontSize: ms(13),
      fontFamily: Fonts.regular,
    },

    /* Overlays */
    overlayLayer: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.background,
    },
  });
