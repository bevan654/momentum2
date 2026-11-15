import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { sw } from '../../theme/responsive';
import { useColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';

const DEFAULT_SIZE = sw(38);
const AVATAR_GRAY = '#4A4A4E';

interface Props {
  username: string | null;
  email: string;
  size?: number;
  bgColor?: string;
}

function AvatarCircle({ username, email, size = DEFAULT_SIZE, bgColor = AVATAR_GRAY }: Props) {
  const colors = useColors();
  const initial = (username || email || '?').charAt(0).toUpperCase();
  const fontSize = size * 0.42;
  const ringWidth = size > sw(50) ? 2.5 : 1.5;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          borderWidth: ringWidth,
          borderColor: bgColor + '40',
        },
      ]}
    >
      <Text style={[styles.initial, { fontSize, color: colors.textOnColor }]}>{initial}</Text>
    </View>
  );
}

export default React.memo(AvatarCircle);

const styles = StyleSheet.create({
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: {
    fontFamily: Fonts.bold,
  },
});
