import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { NotificationItem, NotificationType } from '../../lib/friendsDatabase';

const NOTIFICATION_CONFIG: Record<NotificationType, { icon: string; color: string }> = {
  friend_request: { icon: 'person-add-outline', color: '#3B82F6' },
  friend_accepted: { icon: 'people-outline', color: '#34D399' },
  reaction: { icon: 'heart-outline', color: '#EF4444' },
  nudge: { icon: 'flash-outline', color: '#F59E0B' },
  leaderboard_weekly: { icon: 'trophy-outline', color: '#F59E0B' },
};

interface Props {
  notification: NotificationItem;
  onPress: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  responded?: 'accepted' | 'declined' | null;
}

function NotificationRow({ notification, onPress, onAccept, onDecline, responded }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const config = NOTIFICATION_CONFIG[notification.type] || {
    icon: 'notifications-outline',
    color: colors.textSecondary,
  };
  const isUnread = !notification.read;
  const isActionable = notification.type === 'friend_request' && !responded;

  return (
    <TouchableOpacity
      style={[styles.row, isUnread && styles.unreadRow]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {isUnread && <View style={styles.unreadBorder} />}

      {/* Icon */}
      <View style={[styles.iconCircle, { backgroundColor: config.color + '20' }]}>
        <Ionicons name={config.icon as any} size={ms(18)} color={config.color} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
          {notification.title}
        </Text>
        {notification.body && (
          <Text style={styles.body} numberOfLines={2}>
            {notification.body}
          </Text>
        )}
        <Text style={styles.time}>{formatTimeAgo(notification.created_at)}</Text>

        {/* Action buttons */}
        {isActionable && onAccept && onDecline && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.accentGreen },
              ]}
              onPress={onAccept}
              activeOpacity={0.7}
            >
              <Text style={styles.actionText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.declineBtn]}
              onPress={onDecline}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>
                Decline
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {responded && (
          <View style={styles.respondedRow}>
            <Ionicons
              name={responded === 'accepted' ? 'checkmark-circle' : 'close-circle'}
              size={ms(14)}
              color={responded === 'accepted' ? colors.accentGreen : colors.textTertiary}
            />
            <Text
              style={[
                styles.respondedText,
                { color: responded === 'accepted' ? colors.accentGreen : colors.textTertiary },
              ]}
            >
              {responded === 'accepted' ? 'Accepted' : 'Declined'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default React.memo(NotificationRow);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: sw(16),
    paddingVertical: sw(14),
    gap: sw(12),
    position: 'relative',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.cardBorder,
  },
  unreadRow: {
    backgroundColor: colors.accent + '08',
  },
  unreadBorder: {
    position: 'absolute',
    left: 0,
    top: sw(6),
    bottom: sw(6),
    width: sw(3),
    backgroundColor: colors.accent,
    borderRadius: sw(2),
  },
  iconCircle: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    gap: sw(3),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.medium,
    lineHeight: ms(20),
  },
  titleUnread: {
    fontFamily: Fonts.bold,
  },
  body: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(17),
  },
  time: {
    color: colors.textTertiary,
    fontSize: ms(11),
    fontFamily: Fonts.medium,
    lineHeight: ms(15),
    marginTop: sw(2),
  },
  actions: {
    flexDirection: 'row',
    gap: sw(8),
    marginTop: sw(8),
  },
  actionBtn: {
    borderRadius: sw(10),
    paddingHorizontal: sw(16),
    paddingVertical: sw(7),
  },
  declineBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionText: {
    color: colors.textOnAccent,
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
  },
  respondedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sw(5),
    marginTop: sw(8),
  },
  respondedText: {
    fontSize: ms(13),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(18),
  },
});
