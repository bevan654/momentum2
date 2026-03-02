import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, Platform, Alert } from 'react-native';
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

export default function ShareWorkoutModal({ visible, data, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const viewShotRef = useRef<ViewShot>(null);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePicked = useCallback((uri: string) => {
    if (Platform.OS === 'ios') {
      setCropUri(uri);
    } else {
      setImageUri(uri);
    }
  }, []);

  const pickFromLibrary = useCallback(async () => {
    const isAndroid = Platform.OS === 'android';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: isAndroid,
      ...(isAndroid && { aspect: [9, 16] as [number, number] }),
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      handlePicked(result.assets[0].uri);
    }
  }, [handlePicked]);

  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const isAndroid = Platform.OS === 'android';
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: isAndroid,
      ...(isAndroid && { aspect: [9, 16] as [number, number] }),
      quality: 0.9,
    });
    if (!result.canceled && result.assets[0]) {
      handlePicked(result.assets[0].uri);
    }
  }, [handlePicked]);

  const clearImage = useCallback(() => setImageUri(null), []);

  const handleCropConfirm = useCallback((croppedUri: string) => {
    setCropUri(null);
    setImageUri(croppedUri);
  }, []);

  const handleCropCancel = useCallback(() => setCropUri(null), []);

  const captureCard = useCallback(async (): Promise<string | null> => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      return uri || null;
    } catch {
      return null;
    }
  }, []);

  const saveToGallery = useCallback(async () => {
    setSaving(true);
    try {
      const uri = await captureCard();
      if (!uri) { Alert.alert('Error', 'Failed to capture image.'); return; }
      // Use share sheet — user can tap "Save Image" from there
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      // User cancelled
    } finally {
      setSaving(false);
    }
  }, [captureCard]);

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

  const handleClose = useCallback(() => {
    setImageUri(null);
    setCropUri(null);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.container}>
        <Header />

        {/* Card preview */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            <WorkoutOverlay backgroundUri={imageUri} data={data} />
          </ViewShot>
        </ScrollView>

        {/* Bottom actions */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, sw(16)) }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={pickFromLibrary} activeOpacity={0.7}>
              <Ionicons name="images-outline" size={ms(16)} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.accent }]}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtn} onPress={takePhoto} activeOpacity={0.7}>
              <Ionicons name="camera-outline" size={ms(16)} color={colors.accent} />
              <Text style={[styles.actionText, { color: colors.accent }]}>Camera</Text>
            </TouchableOpacity>

            {imageUri && (
              <TouchableOpacity style={styles.actionBtn} onPress={clearImage} activeOpacity={0.7}>
                <Ionicons name="close-circle-outline" size={ms(16)} color={colors.accentRed} />
                <Text style={[styles.actionText, { color: colors.accentRed }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.footerRow}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={ms(18)} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={saveToGallery}
              activeOpacity={0.7}
              disabled={saving}
            >
              <Ionicons name="download-outline" size={ms(18)} color={colors.textOnAccent} />
              <Text style={styles.saveBtnText}>Save</Text>
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

      {!!cropUri && (
        <StoryCropModal
          visible={!!cropUri}
          imageUri={cropUri!}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </Modal>
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
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      backgroundColor: colors.surface,
      paddingVertical: sw(12),
      borderRadius: sw(12),
    },
    actionText: {
      fontSize: ms(13),
      lineHeight: ms(17),
      fontFamily: Fonts.semiBold,
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
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(6),
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      paddingVertical: sw(12),
    },
    saveBtnText: {
      color: colors.textOnAccent,
      fontSize: ms(14),
      fontFamily: Fonts.bold,
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
  });
