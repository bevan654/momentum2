import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, TextInput } from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';

interface Props {
  visible: boolean;
  onConfirm: (durationSeconds: number) => void;
  onCancel: () => void;
}

export default function DurationPickerModal({ visible, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hours, setHours] = useState('1');
  const [minutes, setMinutes] = useState('0');

  const handleConfirm = () => {
    const h = Math.max(0, parseInt(hours, 10) || 0);
    const m = Math.max(0, Math.min(59, parseInt(minutes, 10) || 0));
    const totalSeconds = h * 3600 + m * 60;
    if (totalSeconds <= 0) return;
    onConfirm(totalSeconds);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onCancel}>
        <TouchableOpacity style={styles.modal} activeOpacity={1}>
          <Text style={styles.title}>Adjust Workout Duration</Text>
          <Text style={styles.subtitle}>
            Your workout has been running for over 4 hours. How long did you actually train?
          </Text>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                value={hours}
                onChangeText={setHours}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.label}>hours</Text>
            </View>

            <Text style={styles.colon}>:</Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.input}
                value={minutes}
                onChangeText={setMinutes}
                keyboardType="number-pad"
                maxLength={2}
                selectTextOnFocus
                placeholderTextColor={colors.textTertiary}
              />
              <Text style={styles.label}>min</Text>
            </View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.7}>
              <Text style={styles.confirmText}>Save</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(24),
    width: '80%',
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(18),
    fontFamily: Fonts.bold,
    lineHeight: ms(24),
    textAlign: 'center',
    marginBottom: sw(8),
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: ms(13),
    fontFamily: Fonts.regular,
    lineHeight: ms(18),
    textAlign: 'center',
    marginBottom: sw(20),
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: sw(12),
    marginBottom: sw(24),
  },
  inputGroup: {
    alignItems: 'center',
    gap: sw(4),
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    fontSize: ms(28),
    fontFamily: Fonts.bold,
    lineHeight: ms(36),
    textAlign: 'center',
    width: sw(72),
    height: sw(56),
    borderRadius: sw(12),
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  label: {
    color: colors.textSecondary,
    fontSize: ms(12),
    fontFamily: Fonts.medium,
    lineHeight: ms(16),
  },
  colon: {
    color: colors.textPrimary,
    fontSize: ms(28),
    fontFamily: Fonts.bold,
    lineHeight: ms(36),
    marginBottom: sw(20),
  },
  buttons: {
    flexDirection: 'row',
    gap: sw(10),
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: sw(12),
    borderRadius: sw(10),
    backgroundColor: colors.accentGreen,
    alignItems: 'center',
  },
  confirmText: {
    color: colors.textOnAccent,
    fontSize: ms(15),
    fontFamily: Fonts.semiBold,
    lineHeight: ms(20),
  },
});
