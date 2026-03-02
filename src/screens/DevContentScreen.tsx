import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../theme/useColors';
import { sw, ms } from '../theme/responsive';
import { Fonts } from '../theme/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AvatarViewer from '../components/dev/AvatarViewer';

interface Props {
  onBack?: () => void;
}

export default function DevContentScreen({ onBack }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.container, !onBack && { paddingTop: 0 }]}>
      {onBack && (
        <View style={[styles.header, { marginTop: insets.top }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.6}>
            <Ionicons name="chevron-back" size={ms(22)} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Dev</Text>
          <View style={{ width: ms(22) }} />
        </View>
      )}

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>Avatar</Text>
        <AvatarViewer />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: sw(16),
      paddingTop: sw(12),
      paddingBottom: sw(8),
    },
    backBtn: {
      padding: sw(4),
    },
    title: {
      color: colors.textPrimary,
      fontSize: ms(17),
      lineHeight: ms(23),
      fontFamily: Fonts.bold,
    },
    list: {
      flex: 1,
    },
    listContent: {
      alignItems: 'center',
      paddingHorizontal: sw(16),
      paddingBottom: sw(40),
      gap: sw(12),
    },
    sectionLabel: {
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.bold,
      alignSelf: 'flex-start',
      marginTop: sw(8),
    },
  });
