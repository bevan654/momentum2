import React, { memo } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { ms } from '../../theme/responsive';
import type { FieldStatus } from '../../hooks/useUsernameAvailability';

/** Hint/icon colour for an availability status: accent when ok, red when taken or invalid. */
export const fieldStatusColor = (status: FieldStatus | undefined, colors: ThemeColors) =>
  status === 'ok'
    ? colors.accent
    : status === 'taken' || status === 'invalid'
    ? colors.accentRed
    : colors.textTertiary;

/** Trailing icon of a checked field: dots while checking, tick when ok, cross when taken/invalid. */
function FieldStatusIcon({ status }: { status: FieldStatus }) {
  const colors = useColors();
  if (status === 'checking') {
    return <Ionicons name="ellipsis-horizontal" size={ms(18)} color={colors.textTertiary} />;
  }
  if (status === 'ok') {
    return <Ionicons name="checkmark-circle" size={ms(18)} color={colors.accent} />;
  }
  if (status === 'taken' || status === 'invalid') {
    return <Ionicons name="close-circle" size={ms(18)} color={colors.accentRed} />;
  }
  return null;
}

export default memo(FieldStatusIcon);
