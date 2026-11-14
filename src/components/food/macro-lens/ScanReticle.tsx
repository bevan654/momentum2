import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw } from '../../../theme/responsive';

type AnimStyle = React.ComponentProps<typeof Animated.View>['style'];

const SCAN_BOX = sw(240);

const Corner = React.memo(function Corner({
  placement,
  color,
}: {
  placement: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}) {
  const base = {
    position: 'absolute' as const,
    width: sw(28),
    height: sw(28),
    borderColor: color,
  };
  if (placement === 'tl') {
    return (
      <View
        style={[
          base,
          { top: 0, left: 0, borderTopWidth: sw(3), borderLeftWidth: sw(3), borderTopLeftRadius: sw(8) },
        ]}
      />
    );
  }
  if (placement === 'tr') {
    return (
      <View
        style={[
          base,
          { top: 0, right: 0, borderTopWidth: sw(3), borderRightWidth: sw(3), borderTopRightRadius: sw(8) },
        ]}
      />
    );
  }
  if (placement === 'bl') {
    return (
      <View
        style={[
          base,
          { bottom: 0, left: 0, borderBottomWidth: sw(3), borderLeftWidth: sw(3), borderBottomLeftRadius: sw(8) },
        ]}
      />
    );
  }
  return (
    <View
      style={[
        base,
        { bottom: 0, right: 0, borderBottomWidth: sw(3), borderRightWidth: sw(3), borderBottomRightRadius: sw(8) },
      ]}
    />
  );
});

/** Camera-mode scan frame: four accent corners around a centre dot, pulsing via reticleStyle. */
function ScanReticle({ reticleStyle }: { reticleStyle: AnimStyle }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Animated.View style={[styles.scanFrame, reticleStyle]}>
      <Corner placement="tl" color={colors.accent} />
      <Corner placement="tr" color={colors.accent} />
      <Corner placement="bl" color={colors.accent} />
      <Corner placement="br" color={colors.accent} />
      <View style={styles.scanFrameInner}>
        <View style={[styles.scanCenterDot, { backgroundColor: colors.accent }]} />
      </View>
    </Animated.View>
  );
}

export default React.memo(ScanReticle);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  scanFrame: {
    width: SCAN_BOX,
    height: SCAN_BOX,
  },
  scanFrameInner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanCenterDot: {
    width: sw(6),
    height: sw(6),
    borderRadius: sw(3),
    opacity: 0.6,
  },
});
