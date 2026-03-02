import React, { useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, Image, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms, SCREEN_WIDTH, SCREEN_HEIGHT } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

/* ─── Crop frame dimensions (9:16 story) ───────────────── */

const FRAME_WIDTH = SCREEN_WIDTH - sw(48);
const FRAME_HEIGHT = FRAME_WIDTH * (16 / 9);

interface Props {
  visible: boolean;
  imageUri: string;
  onConfirm: (croppedUri: string) => void;
  onCancel: () => void;
}

export default function StoryCropModal({ visible, imageUri, onConfirm, onCancel }: Props) {
  const colors = useColors();
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
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.titleText}>Move and Scale</Text>
          <TouchableOpacity onPress={handleConfirm} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>

        {/* Crop area */}
        <View style={styles.cropArea}>
          <GestureDetector gesture={composedGesture}>
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
          </GestureDetector>
        </View>
      </View>
    </Modal>
  );
}

/* ─── Styles ──────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingTop: sw(60),
      paddingBottom: sw(16),
    },
    cancelText: {
      color: '#FFFFFF',
      fontSize: ms(16),
      fontFamily: Fonts.medium,
    },
    titleText: {
      color: '#FFFFFF',
      fontSize: ms(16),
      fontFamily: Fonts.bold,
    },
    doneText: {
      color: colors.accent,
      fontSize: ms(16),
      fontFamily: Fonts.bold,
    },
    cropArea: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    frameContainer: {
      width: FRAME_WIDTH,
      height: FRAME_HEIGHT,
      overflow: 'hidden',
      borderRadius: sw(12),
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#000',
    },
  });
