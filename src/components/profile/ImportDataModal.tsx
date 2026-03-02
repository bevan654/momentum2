import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { sw, ms } from '../../theme/responsive';
import { Fonts } from '../../theme/typography';
import { useImportStore } from '../../stores/useImportStore';
import { useAuthStore } from '../../stores/useAuthStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function ImportDataModal({ visible, onClose }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const userId = useAuthStore((s) => s.user?.id);
  const phase = useImportStore((s) => s.phase);
  const source = useImportStore((s) => s.source);
  const totalWorkouts = useImportStore((s) => s.totalWorkouts);
  const importedCount = useImportStore((s) => s.importedCount);
  const createdExercises = useImportStore((s) => s.createdExercises);
  const errorMessage = useImportStore((s) => s.errorMessage);
  const startImport = useImportStore((s) => s.startImport);
  const reset = useImportStore((s) => s.reset);

  const handleStart = useCallback(() => {
    if (!userId) return;
    startImport(userId);
  }, [userId, startImport]);

  const handleClose = useCallback(() => {
    if (phase === 'picking' || phase === 'parsing' || phase === 'resolving' || phase === 'importing') return;
    reset();
    onClose();
  }, [phase, reset, onClose]);

  const handleTryAgain = useCallback(() => {
    reset();
  }, [reset]);

  const progress = totalWorkouts > 0 ? importedCount / totalWorkouts : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.modal} onStartShouldSetResponder={() => true}>
          {/* ── Idle ─────────────────────────── */}
          {phase === 'idle' && (
            <>
              <Ionicons name="cloud-upload-outline" size={ms(40)} color={colors.accent} style={styles.icon} />
              <Text style={styles.title}>Import your workout history</Text>
              <Text style={styles.subtitle}>Supported formats:</Text>
              <View style={styles.formatList}>
                <Text style={styles.formatItem}>Liftoff (.csv)</Text>
                <Text style={styles.formatItem}>Strong (.tsv)</Text>
              </View>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleStart} activeOpacity={0.8}>
                <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Select File</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Picking / Parsing / Resolving ── */}
          {(phase === 'picking' || phase === 'parsing' || phase === 'resolving') && (
            <>
              <ActivityIndicator size="large" color={colors.accent} style={styles.icon} />
              <Text style={styles.title}>
                {phase === 'picking' && 'Select a file...'}
                {phase === 'parsing' && 'Parsing workout data...'}
                {phase === 'resolving' && 'Creating new exercises...'}
              </Text>
            </>
          )}

          {/* ── Importing ──────────────────────── */}
          {phase === 'importing' && (
            <>
              <Text style={styles.title}>Importing workouts...</Text>
              <Text style={styles.subtitle}>
                {importedCount} of {totalWorkouts}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressBar, { width: `${Math.round(progress * 100)}%`, backgroundColor: colors.accent }]} />
              </View>
            </>
          )}

          {/* ── Done ───────────────────────────── */}
          {phase === 'done' && (
            <>
              <Ionicons name="checkmark-circle" size={ms(40)} color={colors.accentGreen} style={styles.icon} />
              <Text style={styles.title}>Import Complete</Text>
              <View style={styles.statsList}>
                <Text style={styles.statText}>{totalWorkouts} workouts imported</Text>
                {createdExercises > 0 && (
                  <Text style={styles.statText}>{createdExercises} exercises created</Text>
                )}
                {source && (
                  <Text style={styles.statTextDim}>Source: {source === 'liftoff' ? 'Liftoff' : 'Strong'}</Text>
                )}
              </View>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleClose} activeOpacity={0.8}>
                <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Done</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── Error ──────────────────────────── */}
          {phase === 'error' && (
            <>
              <Ionicons name="warning-outline" size={ms(40)} color={colors.accentRed} style={styles.icon} />
              <Text style={styles.title}>Import Failed</Text>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handleTryAgain} activeOpacity={0.8}>
                <Text style={[styles.buttonText, { color: colors.textOnAccent }]}>Try Again</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
      width: '85%',
      alignItems: 'center',
    },
    icon: {
      marginBottom: sw(12),
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
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
      textAlign: 'center',
    },
    formatList: {
      marginTop: sw(8),
      marginBottom: sw(20),
      gap: sw(4),
      alignItems: 'center',
    },
    formatItem: {
      color: colors.textTertiary,
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
    },
    button: {
      borderRadius: sw(10),
      paddingVertical: sw(12),
      paddingHorizontal: sw(32),
      marginTop: sw(12),
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    buttonText: {
      fontSize: ms(15),
      fontFamily: Fonts.semiBold,
      lineHeight: ms(20),
    },
    progressTrack: {
      width: '100%',
      height: sw(6),
      backgroundColor: colors.surface,
      borderRadius: sw(3),
      marginTop: sw(16),
      overflow: 'hidden',
    },
    progressBar: {
      height: '100%',
      borderRadius: sw(3),
    },
    statsList: {
      marginTop: sw(8),
      marginBottom: sw(8),
      gap: sw(4),
      alignItems: 'center',
    },
    statText: {
      color: colors.textPrimary,
      fontSize: ms(14),
      fontFamily: Fonts.medium,
      lineHeight: ms(20),
    },
    statTextDim: {
      color: colors.textTertiary,
      fontSize: ms(12),
      fontFamily: Fonts.medium,
      lineHeight: ms(16),
    },
    errorText: {
      color: colors.accentRed,
      fontSize: ms(13),
      fontFamily: Fonts.medium,
      lineHeight: ms(18),
      textAlign: 'center',
      marginTop: sw(4),
      marginBottom: sw(8),
    },
  });
