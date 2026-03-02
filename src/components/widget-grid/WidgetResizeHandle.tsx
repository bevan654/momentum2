import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { sw, ms } from '../../theme/responsive';
import { useColors } from '../../theme/useColors';

/** Visual-only resize grip rendered at the bottom-right corner of a widget cell. */
export default function ResizeGrip() {
  const colors = useColors();

  return (
    <View style={[styles.grip, { backgroundColor: colors.surface + 'CC' }]}>
      <Ionicons
        name="resize-outline"
        size={ms(12)}
        color={colors.textTertiary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grip: {
    width: sw(22),
    height: sw(22),
    borderRadius: sw(6),
    justifyContent: 'center',
    alignItems: 'center',
  },
});
