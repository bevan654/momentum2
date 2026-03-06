import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Platform, Alert } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import WorkoutOverlay, { type WorkoutOverlayData } from '../dev/WorkoutOverlay';
import StoryCropModal from '../dev/StoryCropModal';
import Header from '../home/Header';

interface Props {
  visible: boolean;
  data: WorkoutOverlayData;
  onClose: () => void;
}

const ANIM_DURATION = 300;
const EASE_OUT = Easing.out(Easing.cubic);
const EASE_IN = Easing.in(Easing.cubic);

export default function ShareWorkoutModal({ visible, data, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const viewShotRef = useRef<ViewShot>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  /* ─── Picker animation (Reanimated, no Modal) ─── */
  const [pickerMounted, setPickerMounted] = useState(false);
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(300);

  const showPicker = useCallback(() => {
    setPickerMounted(true);
    backdropOpacity.value = withTiming(1, { duration: ANIM_DURATION, easing: EASE_OUT });
    sheetTranslateY.value = withTiming(0, { duration: ANIM_DURATION, easing: EASE_OUT });
  }, []);

  const hidePicker = useCallback((onDone?: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 220, easing: EASE_IN });
    sheetTranslateY.value = withTiming(300, { duration: 220, easing: EASE_IN }, () => {
      runOnJS(setPickerMounted)(false);
      if (onDone) runOnJS(onDone)();
    });
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  /* ─── Close / lifecycle ─── */

  const handleClose = useCallback(() => {
    setImageUri(null);
    setCropUri(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!visible) {
      setCameraReady(false);
      setPickerMounted(false);
      backdropOpacity.value = 0;
      sheetTranslateY.value = 300;
      return;
    }
    // Small delay so the component mounts before animating
    const t = setTimeout(() => showPicker(), 50);
    return () => clearTimeout(t);
  }, [visible]);

  /* ─── Camera / Gallery launchers ─── */

  const launchCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setCameraReady(true); return; }
    const isAndroid = Platform.OS === 'android';
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: isAndroid,
      ...(isAndroid && { aspect: [9, 16] as [number, number] }),
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      if (Platform.OS === 'ios') {
        setCropUri(result.assets[0].uri);
      } else {
        setImageUri(result.assets[0].uri);
        setCameraReady(true);
      }
    } else {
      handleClose();
    }
  }, [handleClose]);

  const launchGallery = useCallback(async () => {
    const isAndroid = Platform.OS === 'android';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: isAndroid,
      ...(isAndroid && { aspect: [9, 16] as [number, number] }),
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      if (Platform.OS === 'ios') {
        setCropUri(result.assets[0].uri);
      } else {
        setImageUri(result.assets[0].uri);
        setCameraReady(true);
      }
    } else {
      handleClose();
    }
  }, [handleClose]);

  /* ─── Picker option handlers ─── */

  const onPickCamera = useCallback(() => {
    hidePicker(launchCamera);
  }, [hidePicker, launchCamera]);

  const onPickGallery = useCallback(() => {
    hidePicker(launchGallery);
  }, [hidePicker, launchGallery]);

  const onPickerBackdropPress = useCallback(() => {
    hidePicker(handleClose);
  }, [hidePicker, handleClose]);

  /* ─── Crop handlers ─── */

  const handleCropConfirm = useCallback((croppedUri: string) => {
    setCropUri(null);
    setImageUri(croppedUri);
    setCameraReady(true);
  }, []);

  const handleCropCancel = useCallback(() => {
    setCropUri(null);
    setCameraReady(true);
  }, []);

  /* ─── Capture / Share ─── */

  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      return uri || null;
    } catch {
      return null;
    }
  }, []);

  const shareCard = useCallback(async () => {
    setSaving(true);
    try {
      const uri = await captureCard();
      if (!uri) { Alert.alert('Error', 'Failed to capture image.'); return; }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // User cancelled share
    } finally {
      setSaving(false);
    }
  }, [captureCard]);

  return (
    <>
      {/* Preview modal */}
      <Modal visible={visible && cameraReady} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.container}>
          <Header />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
              <WorkoutOverlay backgroundUri={imageUri} data={data} />
            </ViewShot>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, sw(16)) }]}>
            <View style={styles.footerRow}>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={ms(18)} color={colors.textSecondary} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareBtn}
                onPress={shareCard}
                activeOpacity={0.7}
                disabled={saving}
              >
                <Ionicons name="share-outline" size={ms(18)} color={colors.textOnAccent} />
                <Text style={styles.shareBtnText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Source picker — Reanimated overlay, no Modal */}
      {pickerMounted && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <Animated.View style={[styles.pickerBackdrop, backdropStyle]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={onPickerBackdropPress}
              activeOpacity={1}
            />
          </Animated.View>

          <View style={styles.pickerBottom} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.pickerSheet,
                { paddingBottom: Math.max(insets.bottom, sw(16)) },
                sheetStyle,
              ]}
            >
              <View style={styles.pickerHandle} />
              <Text style={styles.pickerTitle}>Share Workout</Text>
              <Text style={styles.pickerSubtitle}>Add a photo to your workout card</Text>

              <View style={styles.pickerOptions}>
                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={onPickCamera}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pickerIconCircle, { backgroundColor: colors.accent + '15' }]}>
                    <Ionicons name="camera" size={ms(24)} color={colors.accent} />
                  </View>
                  <Text style={styles.pickerOptionText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.pickerOption}
                  onPress={onPickGallery}
                  activeOpacity={0.7}
                >
                  <View style={[styles.pickerIconCircle, { backgroundColor: colors.accentGreen + '15' }]}>
                    <Ionicons name="images" size={ms(24)} color={colors.accentGreen} />
                  </View>
                  <Text style={styles.pickerOptionText}>Gallery</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </View>
        </View>
      )}

      {/* Crop modal */}
      {!!cropUri && (
        <StoryCropModal
          visible={!!cropUri}
          imageUri={cropUri!}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: { flex: 1 },
    scrollContent: {
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingVertical: sw(12),
    },
    footer: {
      gap: sw(8),
      paddingHorizontal: sw(16),
      paddingTop: sw(10),
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    closeBtn: {
      width: sw(48),
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      paddingVertical: sw(12),
      borderRadius: sw(12),
    },
    shareBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      backgroundColor: colors.accentGreen,
      borderRadius: sw(12),
      paddingVertical: sw(12),
    },
    shareBtnText: {
      color: colors.textOnAccent,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
    },

    /* Picker overlay */
    pickerBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    pickerBottom: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: sw(16),
      borderTopRightRadius: sw(16),
      paddingTop: sw(12),
      paddingHorizontal: sw(24),
    },
    pickerHandle: {
      width: sw(36),
      height: sw(4),
      borderRadius: sw(2),
      backgroundColor: colors.textTertiary + '40',
      alignSelf: 'center',
      marginBottom: sw(14),
    },
    pickerTitle: {
      color: colors.textPrimary,
      fontSize: ms(18),
      fontFamily: Fonts.bold,
      lineHeight: ms(24),
      textAlign: 'center',
    },
    pickerSubtitle: {
      color: colors.textTertiary,
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
      textAlign: 'center',
      marginTop: sw(4),
    },
    pickerOptions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(24),
      marginTop: sw(24),
      marginBottom: sw(20),
    },
    pickerOption: {
      alignItems: 'center',
      gap: sw(8),
    },
    pickerIconCircle: {
      width: sw(60),
      height: sw(60),
      borderRadius: sw(30),
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerOptionText: {
      color: colors.textSecondary,
      fontSize: ms(12),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(16),
    },
  });
