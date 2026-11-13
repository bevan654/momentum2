import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import Sheet from '../ui/Sheet';
import FriendSearch from './FriendSearch';

interface Props {
  visible: boolean;
  onClose: () => void;
}

function AddFriendSheet({ visible, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Sheet visible={visible} onClose={onClose} height="70%">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Friends</Text>
        </View>
        <FriendSearch />
      </View>
    </Sheet>
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
  });
