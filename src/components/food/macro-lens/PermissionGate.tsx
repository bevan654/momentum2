import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Overlay from '../../ui/Overlay';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

/** Shown while camera permission isn't granted: ask again, or send the user to Settings. */
function PermissionGate({ canAsk, onRequest, onClose }: {
  canAsk: boolean;
  onRequest: () => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Overlay visible animationType="slide">
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <View style={styles.permIcon}>
            <Ionicons name="camera-outline" size={ms(36)} color={colors.accent} />
          </View>
          <Text style={styles.permTitle}>Enable Camera</Text>
          <Text style={styles.permBody}>
            {canAsk
              ? 'Allow camera access so MacroLens can scan your meals.'
              : 'Camera permission was denied. Enable it in your device settings.'}
          </Text>
          <TouchableOpacity
            style={styles.permBtn}
            onPress={canAsk ? onRequest : () => Linking.openSettings()}
            activeOpacity={0.85}
          >
            <Text style={styles.permBtnText}>
              {canAsk ? 'Allow Camera' : 'Open Settings'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={[styles.topBtn, styles.permClose]}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={ms(22)} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </Overlay>
  );
}

export default React.memo(PermissionGate);

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBtn: {
    width: sw(40),
    height: sw(40),
    borderRadius: sw(20),
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sw(32),
    gap: sw(14),
  },
  permIcon: {
    width: sw(72),
    height: sw(72),
    borderRadius: sw(36),
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: sw(4),
  },
  permTitle: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(24),
    fontFamily: Fonts.extraBold,
    textAlign: 'center',
    letterSpacing: -0.4,
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
    borderRadius: sw(14),
    paddingHorizontal: sw(28),
    paddingVertical: sw(14),
    marginTop: sw(8),
  },
  permBtnText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    lineHeight: ms(20),
    fontFamily: Fonts.bold,
  },
  permClose: {
    position: 'absolute',
    top: sw(54),
    left: sw(16),
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
  },
});
