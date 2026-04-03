import React, { useMemo, useCallback, useState, useRef } from 'react';
import { View, TouchableOpacity, ScrollView, Text, StyleSheet, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import StoryCropModal from '../dev/StoryCropModal';
import BottomSheet from '../workout-sheet/BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: (props: { imageUri: string | null }) => React.ReactNode;
  controls?: React.ReactNode;
}

export default function ShareModal({ visible, onClose, children, controls }: Props) {
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
    <>
      <BottomSheet visible={visible} onClose={handleClose} height="95%" modal>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.title}>Share</Text>
          <TouchableOpacity
            style={[styles.shareBtn, saving && { opacity: 0.5 }]}
            onPress={shareCard}
            activeOpacity={0.7}
            disabled={saving}
          >
            <Ionicons name="paper-plane" size={ms(14)} color={colors.textOnAccent} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {controls}

          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1 }}>
            {children({ imageUri })}
          </ViewShot>
        </ScrollView>

        {/* Bottom actions */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, sw(12)) }]}>
          {/* Image actions */}
          <View style={styles.imageActions}>
            <TouchableOpacity style={styles.imageBtn} onPress={pickFromLibrary} activeOpacity={0.7}>
              <View style={[styles.imageBtnIcon, { backgroundColor: colors.accent + '18' }]}>
                <Ionicons name="images" size={ms(16)} color={colors.accent} />
              </View>
              <Text style={[styles.imageBtnText, { color: colors.textSecondary }]}>Gallery</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto} activeOpacity={0.7}>
              <View style={[styles.imageBtnIcon, { backgroundColor: colors.accent + '18' }]}>
                <Ionicons name="camera" size={ms(16)} color={colors.accent} />
              </View>
              <Text style={[styles.imageBtnText, { color: colors.textSecondary }]}>Camera</Text>
            </TouchableOpacity>

            {imageUri && (
              <TouchableOpacity style={styles.imageBtn} onPress={clearImage} activeOpacity={0.7}>
                <View style={[styles.imageBtnIcon, { backgroundColor: colors.accentRed + '18' }]}>
                  <Ionicons name="close" size={ms(16)} color={colors.accentRed} />
                </View>
                <Text style={[styles.imageBtnText, { color: colors.textSecondary }]}>Remove</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Save action */}
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.5 }]}
            onPress={saveToGallery}
            activeOpacity={0.7}
            disabled={saving}
          >
            <Ionicons name="download-outline" size={ms(16)} color={colors.accent} />
            <Text style={styles.saveBtnText}>Save to Gallery</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

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
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(16),
      paddingBottom: sw(8),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(20),
      lineHeight: ms(26),
      fontFamily: Fonts.bold,
      letterSpacing: -0.3,
    },
    scroll: { flex: 1 },
    scrollContent: {
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingTop: sw(4),
      paddingBottom: sw(16),
    },
    footer: {
      gap: sw(10),
      paddingHorizontal: sw(16),
      paddingTop: sw(10),
      borderTopWidth: 0.5,
      borderTopColor: colors.cardBorder,
    },
    imageActions: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: sw(20),
    },
    imageBtn: {
      alignItems: 'center',
      gap: sw(4),
    },
    imageBtnIcon: {
      width: sw(44),
      height: sw(44),
      borderRadius: sw(14),
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageBtnText: {
      fontSize: ms(10),
      fontFamily: Fonts.medium,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      backgroundColor: colors.surface,
      borderRadius: sw(14),
      paddingVertical: sw(13),
    },
    saveBtnText: {
      color: colors.textSecondary,
      fontSize: ms(13),
      fontFamily: Fonts.semiBold,
    },
    shareBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(6),
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      paddingVertical: sw(8),
      paddingHorizontal: sw(14),
    },
    shareBtnText: {
      color: colors.textOnAccent,
      fontSize: ms(13),
      fontFamily: Fonts.bold,
    },
  });
