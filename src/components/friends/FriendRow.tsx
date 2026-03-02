import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import type { FriendProfile } from '../../lib/friendsDatabase';
import AvatarCircle from './AvatarCircle';

interface Props {
  friend: FriendProfile;
  onPress: () => void;
  onNudge: () => void;
}

function FriendRow({ friend, onPress, onNudge }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.65}>
      {/* Avatar */}
      <AvatarCircle username={friend.username} email={friend.email} />

      {/* Name */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {friend.username || friend.email}
        </Text>
      </View>

      {/* Actions */}
      <TouchableOpacity style={styles.actionBtn} onPress={onNudge} activeOpacity={0.6}>
        <Ionicons name="chatbubble-ellipses-outline" size={ms(16)} color={colors.textSecondary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default React.memo(FriendRow);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: sw(10),
    paddingHorizontal: sw(12),
    paddingVertical: sw(11),
    gap: sw(10),
    backgroundColor: colors.card,
    borderRadius: sw(12),
    marginBottom: sw(5),
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: ms(14),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  actionBtn: {
    width: sw(32),
    height: sw(32),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: colors.cardBorder,
  },
});
