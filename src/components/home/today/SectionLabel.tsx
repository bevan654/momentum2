import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { Fonts } from '../../../theme/typography';

interface Props {
  label: string;
  /** Small detail on the right (e.g. "30 sets · 3 workouts"). */
  detail?: string;
  /** Show a chevron after the detail (the section is tappable). */
  chevron?: boolean;
  /** Makes the detail tappable (shown in the accent colour). */
  onDetailPress?: () => void;
}

/** Small uppercase label that starts each Home section (no cards or lines). */
function SectionLabel({ label, detail, chevron, onDetailPress }: Props) {
  const colors = useColors();
  const s = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      {(detail || chevron) && (
        <View style={s.right}>
          {detail && onDetailPress ? (
            <TouchableOpacity onPress={onDetailPress} hitSlop={8} activeOpacity={0.6}>
              <Text style={[s.detail, s.detailAction]} numberOfLines={1}>{detail}</Text>
            </TouchableOpacity>
          ) : (
            detail && <Text style={s.detail} numberOfLines={1}>{detail}</Text>
          )}
          {chevron && <Ionicons name="chevron-forward" size={ms(12)} color={colors.textTertiary} />}
        </View>
      )}
    </View>
  );
}

export default React.memo(SectionLabel);

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: sw(8) },
    label: {
      color: colors.textTertiary,
      fontSize: ms(11),
      lineHeight: ms(14),
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    right: { flexDirection: 'row', alignItems: 'center', gap: sw(3), flexShrink: 1 },
    detail: { color: colors.textTertiary, fontSize: ms(11), lineHeight: ms(14), fontFamily: Fonts.medium },
    detailAction: { color: colors.accent, fontFamily: Fonts.semiBold },
  });
