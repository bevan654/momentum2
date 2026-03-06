import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, Image, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import ViewShot from 'react-native-view-shot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH, SCREEN_HEIGHT } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { Ionicons } from '@expo/vector-icons';

/* ─── Crop frame dimensions (9:16 story) ───────────────── */

const FRAME_WIDTH = SCREEN_WIDTH - sw(32);
const FRAME_HEIGHT = FRAME_WIDTH * (16 / 9);

interface Props {
  visible: boolean;
  imageUri: string;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function StoryCropModal({ visible, imageUri, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const viewShotRef = useRef<ViewShot>(null);

  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // Compute how big the image renders when "covering" the frame
  const coverLayout = useMemo(() => {
    if (!imgSize.w || !imgSize.h) return { scale: 1, renderedW: FRAME_WIDTH, renderedH: FRAME_HEIGHT };
    const scaleW = FRAME_WIDTH / imgSize.w;
    const scaleH = FRAME_HEIGHT / imgSize.h;
    const scale = Math.max(scaleW, scaleH);
    return {
      scale,
      renderedW: imgSize.w * scale,
      renderedH: imgSize.h * scale,
    };
  }, [imgSize]);

  // Pan + pinch shared values
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  // Store layout dimensions in shared values so worklets can access them
  const renderedW = useSharedValue(coverLayout.renderedW);
  const renderedH = useSharedValue(coverLayout.renderedH);
  renderedW.value = coverLayout.renderedW;
  renderedH.value = coverLayout.renderedH;

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      const s = pinchScale.value;
      const maxX = Math.max(0, (renderedW.value * s - FRAME_WIDTH) / 2);
      const maxY = Math.max(0, (renderedH.value * s - FRAME_HEIGHT) / 2);
      translateX.value = Math.max(-maxX, Math.min(maxX, savedX.value + e.translationX));
      translateY.value = Math.max(-maxY, Math.min(maxY, savedY.value + e.translationY));
    })
    .onEnd(() => {
      'worklet';
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      const newScale = Math.max(1, Math.min(3, savedScale.value * e.scale));
      pinchScale.value = newScale;
      const maxX = Math.max(0, (renderedW.value * newScale - FRAME_WIDTH) / 2);
      const maxY = Math.max(0, (renderedH.value * newScale - FRAME_HEIGHT) / 2);
      translateX.value = Math.max(-maxX, Math.min(maxX, translateX.value));
      translateY.value = Math.max(-maxY, Math.min(maxY, translateY.value));
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = pinchScale.value;
      savedX.value = translateX.value;
      savedY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(panGesture, pinchGesture);

  const imageStyle = useAnimatedStyle(() => ({
    width: renderedW.value,
    height: renderedH.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: pinchScale.value },
    ],
  }));

  // Reset state when image loads
  const handleImageLoad = useCallback(() => {
    if (!imageUri) return;
    Image.getSize(imageUri, (w, h) => {
      setImgSize({ w, h });
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
      pinchScale.value = 1;
      savedScale.value = 1;
    });
  }, [imageUri]);

  // Capture the crop frame as an image
  const handleConfirm = useCallback(async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (uri) {
        onConfirm(uri);
      } else {
        onConfirm(imageUri);
      }
    } catch {
      onConfirm(imageUri);
    }
  }, [imageUri, onConfirm]);

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Blurred background preview */}
        <Image
          source={{ uri: imageUri }}
          style={StyleSheet.absoluteFill}
          blurRadius={30}
        />
        <View style={[StyleSheet.absoluteFill, styles.dimOverlay]} />

        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + sw(12) }]}>
          <TouchableOpacity onPress={onCancel} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={ms(20)} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.titleText}>Move & Scale</Text>
            <Text style={styles.subtitleText}>Pinch to zoom, drag to reposition</Text>
          </View>
          <TouchableOpacity onPress={handleConfirm} style={styles.confirmBtn} activeOpacity={0.7}>
            <Ionicons name="checkmark" size={ms(20)} color={colors.textOnAccent} />
          </TouchableOpacity>
        </View>

        {/* Crop area */}
        <View style={styles.cropArea}>
          <GestureDetector gesture={composedGesture}>
            <View style={styles.frameWrapper}>
              <ViewShot
                ref={viewShotRef}
                options={{ format: 'jpg', quality: 0.9 }}
                style={styles.frameContainer}
              >
                <Animated.Image
                  source={{ uri: imageUri }}
                  style={imageStyle}
                  resizeMode="cover"
                  onLoad={handleImageLoad}
                />
              </ViewShot>
              {/* Corner markers */}
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
          </GestureDetector>
        </View>

        {/* Bottom hint */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + sw(16) }]}>
          <View style={styles.aspectBadge}>
            <Text style={styles.aspectText}>9:16</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const CORNER_SIZE = sw(20);
const CORNER_THICKNESS = sw(3);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    dimOverlay: {
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingBottom: sw(16),
      gap: sw(12),
    },
    headerBtn: {
      width: sw(40),
      height: sw(40),
      borderRadius: sw(20),
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    titleText: {
      color: '#FFFFFF',
      fontSize: ms(17),
      fontFamily: Fonts.bold,
      lineHeight: ms(22),
    },
    subtitleText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(16),
    },
    confirmBtn: {
      width: sw(40),
      height: sw(40),
      borderRadius: sw(20),
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cropArea: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    frameWrapper: {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
    },
    frameContainer: {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
    corner: {
      position: 'absolute',
      width: CORNER_SIZE,
      height: CORNER_SIZE,
    },
    cornerTL: {
      top: -CORNER_THICKNESS / 2,
      left: -CORNER_THICKNESS / 2,
      borderTopWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderTopColor: '#FFFFFF',
      borderLeftColor: '#FFFFFF',
    },
    cornerTR: {
      top: -CORNER_THICKNESS / 2,
      right: -CORNER_THICKNESS / 2,
      borderTopWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderTopColor: '#FFFFFF',
      borderRightColor: '#FFFFFF',
    },
    cornerBL: {
      bottom: -CORNER_THICKNESS / 2,
      left: -CORNER_THICKNESS / 2,
      borderBottomWidth: CORNER_THICKNESS,
      borderLeftWidth: CORNER_THICKNESS,
      borderBottomColor: '#FFFFFF',
      borderLeftColor: '#FFFFFF',
    },
    cornerBR: {
      bottom: -CORNER_THICKNESS / 2,
      right: -CORNER_THICKNESS / 2,
      borderBottomWidth: CORNER_THICKNESS,
      borderRightWidth: CORNER_THICKNESS,
      borderBottomColor: '#FFFFFF',
      borderRightColor: '#FFFFFF',
    },
    footer: {
      alignItems: 'center',
      paddingTop: sw(12),
    },
    aspectBadge: {
      backgroundColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: sw(12),
      paddingVertical: sw(4),
      borderRadius: sw(10),
    },
    aspectText: {
      color: 'rgba(255,255,255,0.5)',
      fontSize: ms(11),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(15),
    },
  });
