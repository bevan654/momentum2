import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import type { FieldStatus } from '../../hooks/useUsernameAvailability';
import FieldStatusIcon, { fieldStatusColor } from './FieldStatusIcon';

const EYE_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

interface Props extends Omit<TextInputProps, 'style' | 'placeholderTextColor' | 'secureTextEntry'> {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  /** Availability status: shows the trailing status icon and colours the hint. */
  status?: FieldStatus;
  /** Pass (even as null) to render the field with a hint slot under it. */
  hint?: string | null;
  /** Password field: hides the text unless `showPassword`, with an eye toggle. */
  onTogglePassword?: () => void;
  showPassword?: boolean;
}

/** Icon + text field used on the auth screens, optionally with a status icon, eye toggle and hint. */
function AuthInput({ icon, status, hint, onTogglePassword, showPassword = false, ...inputProps }: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPassword = onTogglePassword != null;

  const field = (
    <View style={styles.inputContainer}>
      <Ionicons name={icon} size={ms(20)} color={colors.textTertiary} />
      <TextInput
        {...inputProps}
        style={styles.inputField}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={isPassword ? !showPassword : undefined}
      />
      {status != null && <FieldStatusIcon status={status} />}
      {isPassword && (
        <TouchableOpacity onPress={onTogglePassword} hitSlop={EYE_HIT_SLOP}>
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={ms(20)}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  if (hint === undefined) return field;

  return (
    <View>
      {field}
      {hint ? <Text style={[styles.hint, { color: fieldStatusColor(status, colors) }]}>{hint}</Text> : null}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: sw(12),
      paddingHorizontal: sw(16),
      borderWidth: 1,
      borderColor: colors.cardBorder,
      gap: sw(12),
    },
    inputField: {
      flex: 1,
      paddingVertical: sw(16),
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
    },
    hint: {
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginTop: sw(6),
      marginLeft: sw(4),
    },
  });

export default memo(AuthInput);
