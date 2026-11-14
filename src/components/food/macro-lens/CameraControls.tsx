import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

type AnimStyle = React.ComponentProps<typeof Animated.View>['style'];

/** Camera-mode bottom bar: gallery button, shutter and the framing hint. */
function CameraControls({ onPickFromGallery, onShutter, shutterStyle }: {
  onPickFromGallery: () => void;
  onShutter: () => void;
  shutterStyle: AnimStyle;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <>
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />
      <View style={styles.bottomBar}>
        <TouchableOpacity
          onPress={onPickFromGallery}
          style={styles.galleryBtn}
          activeOpacity={0.75}
        >
          <Ionicons name="images-outline" size={ms(22)} color="#FFF" />
        </TouchableOpacity>
        <Animated.View style={shutterStyle}>
          <TouchableOpacity
            onPress={onShutter}
            style={styles.shutterOuter}
            activeOpacity={0.9}
          >
            <View style={styles.shutterMid}>
              <View style={[styles.shutterInner, { backgroundColor: colors.accent }]}>
                <Ionicons name="aperture" size={ms(22)} color="#FFF" />
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
        <View style={styles.galleryBtn} />
      </View>
      <Text style={styles.frameHint}>Frame your meal · tap to scan</Text>
    </>
  );
}

export default React.memo(CameraControls);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: sw(220),
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: sw(28),
    paddingBottom: sw(8),
  },
  galleryBtn: {
    width: sw(48),
    height: sw(48),
    borderRadius: sw(24),
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: sw(86),
    height: sw(86),
    borderRadius: sw(43),
    borderWidth: sw(3),
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterMid: {
    width: sw(72),
    height: sw(72),
    borderRadius: sw(36),
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: sw(58),
    height: sw(58),
    borderRadius: sw(29),
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameHint: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: ms(11),
    lineHeight: ms(14),
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    paddingBottom: sw(40),
    paddingTop: sw(10),
    letterSpacing: 0.3,
  },
});
