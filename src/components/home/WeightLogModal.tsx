import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  Modal,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (weight: number) => Promise<{ error: string | null }>;
}

export default function WeightLogModal({ visible, onClose, onSave }: Props) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleSave = async () => {
    const weight = parseFloat(value);
    if (!weight || weight <= 0) {
      Alert.alert('Error', 'Enter a valid weight');
      return;
    }
    setSaving(true);
    const { error } = await onSave(weight);
    setSaving(false);
    if (error) {
      Alert.alert('Error', error);
    } else {
      setValue('');
      onClose();
    }
  };

  const handleClose = () => {
    setValue('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <KeyboardAvoidingView
          style={styles.centered}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modal}>
            <Text style={styles.title}>Log Weight</Text>

            <TextInput
              style={styles.input}
              placeholder="Weight (kg)"
              placeholderTextColor={colors.textTertiary}
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              autoFocus
            />

            <View style={styles.buttons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: colors.card,
    borderRadius: sw(16),
    padding: sw(24),
    width: '85%',
    maxWidth: sw(340),
  },
  title: {
    color: colors.textPrimary,
    fontSize: ms(20),
    lineHeight: ms(25),
    fontFamily: Fonts.bold,
    marginBottom: sw(20),
    textAlign: 'center',
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    padding: sw(14),
    color: colors.textPrimary,
    fontSize: ms(18),
    lineHeight: ms(24),
    fontFamily: Fonts.medium,
    textAlign: 'center',
    marginBottom: sw(20),
  },
  buttons: {
    flexDirection: 'row',
    gap: sw(12),
  },
  cancelButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: sw(10),
    paddingVertical: sw(14),
    alignItems: 'center',
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: sw(10),
    paddingVertical: sw(14),
    alignItems: 'center',
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.textOnAccent,
    fontSize: ms(16),
    lineHeight: ms(22),
    fontFamily: Fonts.semiBold,
  },
});
