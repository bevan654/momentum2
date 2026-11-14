import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Overlay from '../ui/Overlay';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { lookupBarcode, saveBarcodeFoodToDb } from '../../utils/barcodeApi';
import { useAuthStore } from '../../stores/useAuthStore';
import type { FoodDetailData } from './FoodDetailModal';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onFoodFound: (food: FoodDetailData) => void;
  onNotFound: (barcode: string) => void;
}

const SCAN_AREA = sw(260);
const CORNER_LEN = sw(24);
const CORNER_THICK = sw(3);

export default function BarcodeScannerModal({
  visible,
  onDismiss,
  onFoodFound,
  onNotFound,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  // Refs, not state: the camera reports a code on every frame, faster than a re-render,
  // so a state flag let several lookups start for one scan.
  const busyRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      const code = result.data;
      if (busyRef.current || code === lastCodeRef.current) return;
      busyRef.current = true;
      lastCodeRef.current = code;
      setScanning(true);

      try {
        const { found, food } = await lookupBarcode(code);
        if (!mountedRef.current) return; // closed while looking up
        if (found && food) {
          // Fire-and-forget: save to shared barcode_foods table
          const userId = useAuthStore.getState().user?.id;
          if (userId) {
            saveBarcodeFoodToDb(code, food, userId);
          }
          onFoodFound(food);
        } else {
          onNotFound(code);
        }
      } catch {
        if (mountedRef.current) onNotFound(code);
      } finally {
        busyRef.current = false;
        setScanning(false);
      }
    },
    [onFoodFound, onNotFound],
  );

  // Reset state each time modal opens
  // (The scanner remounts each time it opens, so the scan-lock refs start fresh; resetting
  // them here, after the slide-in, could unlock a lookup that's still running.)
  const handleShow = useCallback(() => {
    setScanning(false);
    setTorch(false);
  }, []);

  if (!visible) return null;

  /* ── Permission states ────────────────────────────────── */

  const renderPermissionScreen = () => {
    if (!permission) return null; // still loading

    if (!permission.granted) {
      const canAsk = permission.canAskAgain;
      return (
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={ms(48)} color={colors.textTertiary} />
          <Text style={styles.permTitle}>Camera Access Required</Text>
          <Text style={styles.permBody}>
            {canAsk
              ? 'Allow camera access to scan food barcodes.'
              : 'Camera permission was denied. Please enable it in your device settings.'}
          </Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={canAsk ? requestPermission : () => Linking.openSettings()}
            activeOpacity={0.8}
          >
            <Text style={styles.permBtnText}>
              {canAsk ? 'Allow Camera' : 'Open Settings'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <Overlay visible animationType="slide" onShow={handleShow} onRequestClose={onDismiss}>
      <View style={styles.container}>
        {permission?.granted ? (
          <>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
              }}
              onBarcodeScanned={scanning ? undefined : handleBarcodeScanned}
            />

            {/* Overlay */}
            <View style={styles.overlay} pointerEvents="box-none">
              {/* Top bar */}
              <View style={styles.topBar}>
                <TouchableOpacity onPress={onDismiss} style={styles.topBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={ms(26)} color="#FFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setTorch((t) => !t)}
                  style={styles.topBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={torch ? 'flash' : 'flash-outline'}
                    size={ms(22)}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </View>

              {/* Scan area */}
              <View style={styles.scanAreaWrapper}>
                <View style={styles.scanArea}>
                  {/* Corner brackets */}
                  <Corner style={styles.cornerTL} />
                  <Corner style={styles.cornerTR} rotate="90deg" />
                  <Corner style={styles.cornerBL} rotate="270deg" />
                  <Corner style={styles.cornerBR} rotate="180deg" />
                </View>
              </View>

              {/* Bottom label */}
              <View style={styles.bottomBar}>
                {scanning ? (
                  <View style={styles.statusRow}>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.statusText}>Looking up product...</Text>
                  </View>
                ) : (
                  <Text style={styles.statusText}>Point at a barcode</Text>
                )}
              </View>
            </View>
          </>
        ) : (
          <>
            {renderPermissionScreen()}
            {/* Close button on permission screen */}
            <TouchableOpacity
              onPress={onDismiss}
              style={[styles.topBtn, styles.permClose]}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={ms(26)} color={colors.textPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    </Overlay>
  );
}

/* ── Corner bracket component ──────────────────────────── */

const Corner = React.memo(function Corner({ style, rotate }: { style: object; rotate?: string }) {
  return (
    <View
      style={[
        {
          position: 'absolute',
          width: CORNER_LEN,
          height: CORNER_LEN,
          borderColor: '#FFF',
          borderTopWidth: CORNER_THICK,
          borderLeftWidth: CORNER_THICK,
          borderTopLeftRadius: sw(4),
        },
        style,
        rotate ? { transform: [{ rotate }] } : undefined,
      ]}
    />
  );
});

/* ── Styles ─────────────────────────────────────────────── */

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
    },

    /* Top bar */
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingTop: sw(54),
      paddingHorizontal: sw(16),
    },
    topBtn: {
      width: sw(44),
      height: sw(44),
      borderRadius: sw(22),
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },

    /* Scan area */
    scanAreaWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanArea: {
      width: SCAN_AREA,
      height: SCAN_AREA,
    },
    cornerTL: { top: 0, left: 0 },
    cornerTR: { top: 0, right: 0 },
    cornerBL: { bottom: 0, left: 0 },
    cornerBR: { bottom: 0, right: 0 },

    /* Bottom */
    bottomBar: {
      alignItems: 'center',
      paddingBottom: sw(80),
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(8),
    },
    statusText: {
      color: '#FFF',
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.semiBold,
    },

    /* Permission screen */
    permissionContainer: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: sw(32),
      gap: sw(12),
    },
    permTitle: {
      color: colors.textPrimary,
      fontSize: ms(18),
      lineHeight: ms(24),
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    permBody: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    permBtn: {
      backgroundColor: colors.accent,
      borderRadius: sw(12),
      paddingHorizontal: sw(28),
      paddingVertical: sw(14),
      marginTop: sw(8),
    },
    permBtnText: {
      color: colors.textOnAccent,
      fontSize: ms(15),
      lineHeight: ms(21),
      fontFamily: Fonts.bold,
    },
    permClose: {
      position: 'absolute',
      top: sw(54),
      left: sw(16),
      backgroundColor: colors.card,
    },
  });
