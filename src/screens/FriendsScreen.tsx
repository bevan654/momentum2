import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../theme/useColors';
import FriendsTab from '../components/friends/FriendsTab';

export default function FriendsScreen() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <FriendsTab />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
