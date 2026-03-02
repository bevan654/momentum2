import React, { useCallback, useMemo } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';

interface Props {
  onPress: () => void;
}

function FloatingAddButton({ onPress }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  }, [onPress]);

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom: sw(16) + insets.bottom + sw(60) }]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Ionicons name="add" size={ms(28)} color={colors.textOnAccent} />
    </TouchableOpacity>
  );
}

export default React.memo(FloatingAddButton);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fab: {
    position: 'absolute',
    right: sw(20),
    width: sw(56),
    height: sw(56),
    borderRadius: sw(28),
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
  },
});
