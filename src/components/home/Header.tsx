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
import Sheet from '../ui/Sheet';
import { useToday } from '../../hooks/useToday';
import { DAY_SHORT, MONTH_SHORT } from '../../constants/dateNames';


/* ─── Header ────────────────────────────────────────────── */

export default function Header({ homeDesign = false }: { homeDesign?: boolean }) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const username = useAuthStore((s) => s.profile?.username ?? null);
  const email = useAuthStore((s) => s.profile?.email ?? '');
  const currentStreak = useStreakStore((s) => s.currentStreak);
  const unreadCount = useFriendsStore((s) => s.unreadCount);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // First name only ("Hi Bevan"); the date follows midnight while the app stays open.
  const firstName = useMemo(() => {
    const first = (username || '').trim().split(/\s+/)[0];
    return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : '';
  }, [username]);
  const today = useToday();
  const dateLabel = useMemo(() => {
    const d = new Date();
    return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
  }, [today]);

  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const [notifOpen, setNotifOpen] = useState(false);
  const openNotif = useCallback(() => setNotifOpen(true), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);

  return (
    <View style={[styles.container, homeDesign && styles.homeContainer, { paddingTop: insets.top }]}>
      <View style={[styles.row, homeDesign && styles.homeRow]}>
        {homeDesign ? <>
        {/* Avatar + greeting — left */}
        <TouchableOpacity style={styles.who} onPress={openProfileSheet} activeOpacity={0.7} accessibilityLabel="Open profile">
          <View style={[styles.avatarRing, styles.homeAvatarRing]}>
            <AvatarCircle username={username} email={email} size={sw(36)} bgColor={colors.accent} />
          </View>
          <View>
            <Text style={styles.hi} numberOfLines={1}>{firstName ? `Hi ${firstName}` : 'Hi there'}</Text>
            <Text style={styles.date}>{dateLabel}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.spacer} />

        {/* Streak + notifications — one capsule, split by a hairline */}
        <View style={styles.capsule}>
          <View style={styles.capsuleItem} accessibilityLabel={`${currentStreak}-day streak`}>
            <Ionicons name="flame" size={ms(15)} color={colors.streak} />
            <Text style={[styles.streakText, styles.homeStreakText]}>{currentStreak}</Text>
          </View>
          <View style={styles.capsuleDivider} />
          <TouchableOpacity
            onPress={openNotif}
            activeOpacity={0.6}
            style={[styles.capsuleItem, styles.bellItem]}
            hitSlop={6}
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${badgeText} unread` : 'Notifications'}
          >
            <Ionicons name={unreadCount > 0 ? 'notifications' : 'notifications-outline'} size={ms(17)} color={colors.textPrimary} />
            {unreadCount > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        </View>
        </> : <>
        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.greetingName}>
            {(username || 'there').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')}
          </Text>
        </View>
        <View style={styles.spacer} />
        <View style={styles.streakBadge}>
          <Ionicons name="flame" size={ms(13)} color={colors.streak} />
          <Text style={styles.streakText}>{currentStreak}</Text>
        </View>
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
            <AvatarCircle username={username} email={email} size={sw(28)} bgColor={colors.accent} />
          </View>
        </TouchableOpacity>
        </>}
      </View>

      <Sheet visible={notifOpen} onClose={closeNotif} height="70%">
        <NotificationList />
      </Sheet>
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
  homeContainer: { borderBottomWidth: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: sw(4),
    gap: sw(12),
  },
  homeRow: {
    paddingTop: sw(2),
    paddingBottom: sw(8),
    gap: sw(10),
  },
  spacer: {
    flex: 1,
  },
  greetingBlock: { justifyContent: 'center' },
  greeting: { color: colors.textTertiary, fontSize: ms(13), fontFamily: Fonts.medium, lineHeight: ms(15) },
  greetingName: { color: colors.textPrimary, fontSize: ms(18), fontFamily: Fonts.bold, lineHeight: ms(21) },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: sw(3),
    backgroundColor: colors.streak + '18', paddingHorizontal: sw(8), paddingVertical: sw(4), borderRadius: sw(10),
  },
  bellWrap: { position: 'relative', padding: sw(4) },
  bellBadge: {
    position: 'absolute', top: 0, right: 0, backgroundColor: colors.accentRed,
    borderRadius: sw(8), minWidth: sw(16), height: sw(16), justifyContent: 'center',
    alignItems: 'center', paddingHorizontal: sw(3), borderWidth: 1.5, borderColor: colors.navBar,
  },
  bellBadgeText: { color: colors.textOnAccent, fontSize: ms(8), fontFamily: Fonts.bold, lineHeight: ms(11) },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(10),
    flexShrink: 1,
  },
  hi: {
    color: colors.textPrimary,
    fontSize: ms(17),
    fontFamily: Fonts.bold,
    lineHeight: ms(21),
  },
  date: {
    color: colors.textTertiary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
  },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: sw(38),
    paddingHorizontal: sw(4),
    borderRadius: sw(19),
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.cardBorder,
  },
  capsuleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(4),
    height: '100%',
    paddingHorizontal: sw(10),
  },
  bellItem: {
    paddingHorizontal: sw(9),
  },
  capsuleDivider: {
    width: StyleSheet.hairlineWidth,
    height: sw(18),
    backgroundColor: colors.textTertiary + '55',
  },
  streakText: {
    color: colors.streak,
    fontSize: ms(12),
    fontFamily: Fonts.bold,
  },
  homeStreakText: { color: colors.textPrimary, fontSize: ms(14) },
  unreadDot: {
    position: 'absolute',
    top: sw(9),
    right: sw(8),
    width: sw(8),
    height: sw(8),
    borderRadius: sw(4),
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  avatarRing: {
    borderWidth: 1.5,
    borderColor: colors.accent + '50',
    borderRadius: sw(16),
    padding: sw(1.5),
  },
  homeAvatarRing: { borderRadius: sw(21) },
});
