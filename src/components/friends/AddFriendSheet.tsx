import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import BottomSheet from '../workout-sheet/BottomSheet';
import FriendSearch from './FriendSearch';
import { useNetworkStore } from '../../stores/useNetworkStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function AddFriendSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const isOffline = useNetworkStore((s) => s.isOffline);
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <BottomSheet visible={visible} onClose={onClose} height="70%" modal>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Friends</Text>
        </View>
        {isOffline ? (
          <View style={styles.offlineState}>
            <Ionicons name="cloud-offline-outline" size={ms(32)} color={colors.textTertiary} />
            <Text style={styles.offlineTitle}>No Connection</Text>
            <Text style={styles.offlineSubtext}>Search requires a connection</Text>
          </View>
        ) : (
          <FriendSearch />
        )}
      </View>
    </BottomSheet>
  );
}

export default React.memo(AddFriendSheet);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      paddingVertical: sw(12),
      borderBottomWidth: 0.5,
      borderBottomColor: colors.cardBorder,
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
    },
    offlineState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      paddingBottom: sw(40),
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
  });
