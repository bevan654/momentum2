import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ThemeColors } from '../../../theme/useColors';
import { Fonts } from '../../../theme/typography';
import { sw, ms } from '../../../theme/responsive';
import type { Routine } from '../../../stores/useRoutineStore';
import { titleCase } from '../../../utils/titleCase';

/* ─── Routine picker row ──────────────────────────────── */

export const RoutinePickerRow = memo(function RoutinePickerRow({
  routine,
  onSelect,
  colors,
}: {
  routine: Routine;
  onSelect: (routine: Routine) => void;
  colors: ThemeColors;
}) {
  const exNames = routine.exercises.slice(0, 4).map((e) => titleCase(e.name)).join(', ');
  const extra = routine.exercises.length > 4 ? ` +${routine.exercises.length - 4}` : '';

  return (
    <TouchableOpacity
      style={{
        backgroundColor: colors.card,
        padding: sw(12),
        marginBottom: sw(4),
        borderRadius: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: sw(10),
      }}
      onPress={() => onSelect(routine)}
      activeOpacity={0.6}
    >
      <View style={{ flex: 1, gap: sw(2) }}>
        <Text style={{ color: colors.textPrimary, fontSize: ms(14), fontFamily: Fonts.semiBold }} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text style={{ color: colors.textTertiary, fontSize: ms(11), fontFamily: Fonts.medium }} numberOfLines={1}>
          {routine.exercises.length} exercise{routine.exercises.length !== 1 ? 's' : ''} · {exNames}{extra}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={ms(16)} color={colors.textTertiary} />
    </TouchableOpacity>
  );
});
