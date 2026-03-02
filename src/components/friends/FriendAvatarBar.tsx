import React, { useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useFriendsStore } from '../../stores/useFriendsStore';
import type { FriendProfile } from '../../lib/friendsDatabase';
import AvatarCircle from './AvatarCircle';

interface Props {
  onOpenProfile: (friend: FriendProfile) => void;
  onOpenSearch: () => void;
}

function FriendAvatarBar({ onOpenProfile, onOpenSearch }: Props) {
  const friends = useFriendsStore((s) => s.friends);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const renderFriend = useCallback(
    (friend: FriendProfile) => {
      const label = friend.username || friend.email.split('@')[0];
      return (
        <TouchableOpacity
          key={friend.id}
          style={styles.avatarItem}
          onPress={() => onOpenProfile(friend)}
          activeOpacity={0.7}
        >
          <AvatarCircle
            username={friend.username}
            email={friend.email}
            size={sw(56)}
            bgColor={colors.accentBlue}
          />
          <Text style={styles.avatarLabel} numberOfLines={1}>
            {label}
          </Text>
        </TouchableOpacity>
      );
    },
    [onOpenProfile, colors, styles],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Add friend button */}
        <TouchableOpacity
          style={styles.avatarItem}
          onPress={onOpenSearch}
          activeOpacity={0.7}
        >
          <View style={styles.addCircle}>
            <Ionicons name="add" size={ms(22)} color={colors.accent} />
          </View>
          <Text style={styles.avatarLabel} numberOfLines={1}>
            Add
          </Text>
        </TouchableOpacity>

        {friends.map(renderFriend)}
      </ScrollView>
    </View>
  );
}

export default React.memo(FriendAvatarBar);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    scrollContent: {
      paddingHorizontal: sw(12),
      paddingVertical: sw(10),
      gap: sw(14),
    },
    avatarItem: {
      alignItems: 'center',
      width: sw(64),
    },
    addCircle: {
      width: sw(56),
      height: sw(56),
      borderRadius: sw(28),
      borderWidth: 1.5,
      borderColor: colors.accent + '50',
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.accent + '08',
    },
    avatarLabel: {
      color: colors.textSecondary,
      fontSize: ms(11),
      fontFamily: Fonts.medium,
      lineHeight: ms(15),
      marginTop: sw(4),
      textAlign: 'center',
    },
  });
