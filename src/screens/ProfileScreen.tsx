import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useColors, type ThemeColors } from '../theme/useColors';
import { useThemeStore } from '../stores/useThemeStore';
import { useProfileSettingsStore } from '../stores/useProfileSettingsStore';
import ProfileMainView from '../components/profile/ProfileMainView';
import ProfileSettingsView from '../components/profile/ProfileSettingsView';
import PatchNotesView from '../components/profile/PatchNotesView';

interface Props {
  onClose?: () => void;
}

export default function ProfileScreen({ onClose }: Props) {
  const [subView, setSubView] = useState<'main' | 'settings' | 'patchNotes'>('main');
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Load persisted theme + profile settings on mount
  useEffect(() => {
    useThemeStore.getState().loadTheme();
    useProfileSettingsStore.getState().loadSettings();
  }, []);

  const openSettings = useCallback(() => setSubView('settings'), []);
  const openPatchNotes = useCallback(() => setSubView('patchNotes'), []);
  const goBack = useCallback(() => setSubView('main'), []);

  return (
    <View style={styles.container}>
      {subView === 'main' ? (
        <ProfileMainView onOpenSettings={openSettings} onOpenPatchNotes={openPatchNotes} onClose={onClose} />
      ) : subView === 'settings' ? (
        <ProfileSettingsView onBack={goBack} />
      ) : (
        <PatchNotesView onBack={goBack} />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
