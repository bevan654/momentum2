import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/useAuthStore';
import { useStreakStore } from '../../stores/useStreakStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import AvatarCircle from '../friends/AvatarCircle';
import { openProfileSheet } from '../../lib/navigationBridge';
import NotificationList from '../friends/NotificationList';
import BottomSheet from '../workout-sheet/BottomSheet';

/* ─── Header ────────────────────────────────────────────── */

interface HeaderProps {
  activeTab?: string;
}

export default function Header({ activeTab }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const username = useAuthStore((s) => s.profile?.username ?? null);
  const email = useAuthStore((s) => s.profile?.email ?? '');
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const unreadCount = useFriendsStore((s) => s.unreadCount);
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isWorkouts = activeTab === 'Workouts';
  const showStreak = true;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const [notifOpen, setNotifOpen] = useState(false);
  const openNotif = useCallback(() => setNotifOpen(true), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        {/* Greeting + name — left */}
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.greetingName}>
            {(username || 'there').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
          </Text>
        </View>

        <View style={styles.spacer} />

        {/* Streak + Avatar — right */}
        {showStreak && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={ms(13)} color={colors.streak} />
            <Text style={styles.streakText}>{currentStreak}</Text>
          </View>
        )}
        <TouchableOpacity onPress={openNotif} activeOpacity={0.7} style={styles.bellWrap}>
          <Ionicons name="notifications-outline" size={ms(18)} color={colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{badgeText}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.7}>
          <View style={styles.avatarRing}>
            <AvatarCircle
              username={username}
              email={email}
              size={sw(28)}
              bgColor={colors.accent}
            />
          </View>
        </TouchableOpacity>
      </View>

      <BottomSheet visible={notifOpen} onClose={closeNotif} height="70%" modal>
        <NotificationList />
      </BottomSheet>
    </View>
  );
}

/* ─── Header styles ─────────────────────────────────────── */

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    backgroundColor: colors.navBar,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.cardBorder,
    zIndex: 10,
    paddingHorizontal: sw(16),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: sw(4),
    gap: sw(12),
  },
  spacer: {
    flex: 1,
  },
  greetingBlock: {
    justifyContent: 'center',
  },
  greeting: {
    color: colors.textTertiary,
    fontSize: ms(13),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },
  greetingName: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(3),
    backgroundColor: colors.streak + '18',
    paddingHorizontal: sw(8),
    paddingVertical: sw(4),
    borderRadius: sw(10),
  },
  streakText: {
    color: colors.streak,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
  },
  bellWrap: {
    position: 'relative',
    padding: sw(4),
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accentRed,
    borderRadius: sw(8),
    minWidth: sw(16),
    height: sw(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sw(3),
    borderWidth: 1.5,
    borderColor: colors.navBar,
  },
  bellBadgeText: {
    color: colors.textOnAccent,
    fontSize: ms(8),
    fontFamily: Fonts.bold,
    lineHeight: ms(11),
  },
  avatarRing: {
    borderWidth: 1.5,
    borderColor: colors.accent + '50',
    borderRadius: sw(16),
    padding: sw(1.5),
  },
});
