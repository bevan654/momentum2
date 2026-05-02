import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { useAuthStore } from '../../stores/useAuthStore';
import { useFriendsStore } from '../../stores/useFriendsStore';
import { openProfileSheet } from '../../lib/navigationBridge';
import AvatarCircle from '../friends/AvatarCircle';
import BottomSheet from '../workout-sheet/BottomSheet';
import NotificationList from '../friends/NotificationList';
import SharePreview from './SharePreview';

function greetingForHour(h: number) {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// DEV_OVERRIDE: 'basic' | 'premium' — wire to real subscription state later.
const __DEV_TIER_OVERRIDE__: 'basic' | 'premium' = 'premium';

function HomeHeader() {
  const username = useAuthStore((s) => s.profile?.username ?? null);
  const email = useAuthStore((s) => s.profile?.email ?? '');
  const unreadCount = useFriendsStore((s) => s.unreadCount);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const displayName = (username || 'there')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  const [notifOpen, setNotifOpen] = useState(false);
  const openNotif = useCallback(() => setNotifOpen(true), []);
  const closeNotif = useCallback(() => setNotifOpen(false), []);
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const [shareOpen, setShareOpen] = useState(false);
  const openShare = useCallback(() => setShareOpen(true), []);
  const closeShare = useCallback(() => setShareOpen(false), []);

  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity onPress={openProfileSheet} activeOpacity={0.7}>
          <AvatarCircle
            username={username}
            email={email}
            size={sw(44)}
            bgColor={colors.accent}
          />
        </TouchableOpacity>

        <View style={styles.greetingBlock}>
          <Text style={styles.greeting}>{greeting},</Text>
          <View style={styles.nameRow}>
            <Text style={styles.greetingName} numberOfLines={1}>
              {displayName}
            </Text>
            {__DEV_TIER_OVERRIDE__ === 'premium' && (
              <View style={styles.proPill}>
                <Text style={styles.proPillText}>PRO</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity onPress={openShare} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="share-outline" size={ms(18)} color={colors.textPrimary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={openNotif} activeOpacity={0.7} style={styles.iconBtn}>
          <Ionicons name="notifications-outline" size={ms(20)} color={colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>{badgeText}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <BottomSheet visible={notifOpen} onClose={closeNotif} height="70%" modal>
        <NotificationList />
      </BottomSheet>

      <SharePreview visible={shareOpen} onClose={closeShare} />
    </>
  );
}

export default React.memo(HomeHeader);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(12),
    paddingVertical: sw(4),
  },
  greetingBlock: {
    flex: 1,
    justifyContent: 'center',
  },
  greeting: {
    color: colors.textTertiary,
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.medium,
  },
  greetingName: {
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.bold,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(6),
  },
  proPill: {
    backgroundColor: colors.accent,
    paddingHorizontal: sw(6),
    paddingVertical: sw(2),
    borderRadius: sw(4),
  },
  proPillText: {
    color: colors.textOnAccent,
    fontSize: ms(9),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
    letterSpacing: 0.8,
  },
  iconBtn: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(20),
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: sw(4),
    right: sw(4),
    backgroundColor: colors.accentRed,
    borderRadius: sw(8),
    minWidth: sw(16),
    height: sw(16),
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sw(3),
    borderWidth: 1.5,
    borderColor: colors.background,
  },
  bellBadgeText: {
    color: colors.textOnAccent,
    fontSize: ms(8),
    lineHeight: ms(11),
    fontFamily: Fonts.bold,
  },
});
