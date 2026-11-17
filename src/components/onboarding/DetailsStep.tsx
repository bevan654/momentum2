import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors, type ThemeColors } from '../../theme/useColors';
import { Fonts } from '../../theme/typography';
import { sw, ms } from '../../theme/responsive';
import { USERNAME_MAX, USERNAME_MIN, type FieldStatus } from '../../hooks/useUsernameAvailability';
import FieldStatusIcon, { fieldStatusColor } from '../auth/FieldStatusIcon';
import UnitInput from './UnitInput';
import { ACTIVITY_OPTIONS, type ActivityKey } from './onboardingPlan';

interface Props {
  needsUsername: boolean;
  username: string;
  onUsernameChange: (value: string) => void;
  usernameStatus: FieldStatus;
  gender: string | null;
  onGenderChange: (gender: string) => void;
  age: string;
  onAgeChange: (value: string) => void;
  height: string;
  onHeightChange: (value: string) => void;
  weight: string;
  onWeightChange: (value: string) => void;
  activity: ActivityKey | null;
  onActivityChange: (activity: ActivityKey) => void;
}

/** Onboarding step 1: username (accounts without one), gender, age, height, weight, activity level. */
function DetailsStep({
  needsUsername, username, onUsernameChange, usernameStatus,
  gender, onGenderChange, age, onAgeChange, height, onHeightChange,
  weight, onWeightChange, activity, onActivityChange,
}: Props) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const usernameHint = useMemo(() => {
    if (!needsUsername || username.length === 0) return null;
    if (usernameStatus === 'checking') return 'Checking availability…';
    if (usernameStatus === 'taken') return 'Username is already taken';
    if (usernameStatus === 'ok') return 'Username available';
    if (username.length < USERNAME_MIN) {
      const remaining = USERNAME_MIN - username.length;
      return `${remaining} more character${remaining === 1 ? '' : 's'} needed`;
    }
    return 'Letters, numbers, and underscores only';
  }, [needsUsername, username, usernameStatus]);

  return (
    <View style={styles.detailsStack}>
      {needsUsername && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Username</Text>
          <View style={styles.usernameInputWrap}>
            <Ionicons name="person-outline" size={ms(20)} color={colors.textTertiary} />
            <TextInput
              style={styles.usernameInput}
              placeholder={`Choose a username (${USERNAME_MIN}–${USERNAME_MAX})`}
              placeholderTextColor={colors.textTertiary}
              value={username}
              onChangeText={onUsernameChange}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              maxLength={USERNAME_MAX}
            />
            <FieldStatusIcon status={usernameStatus} />
          </View>
          {usernameHint && (
            <Text style={[styles.usernameHint, { color: fieldStatusColor(usernameStatus, colors) }]}>
              {usernameHint}
            </Text>
          )}
        </View>
      )}

      {/* Gender */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Gender</Text>
        <View style={styles.genderRow}>
          <TouchableOpacity
            style={[styles.genderCard, gender === 'male' && styles.genderCardSelected]}
            onPress={() => onGenderChange('male')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="male"
              size={ms(28)}
              color={gender === 'male' ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.genderLabel, gender === 'male' && styles.genderLabelSelected]}>
              Male
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.genderCard, gender === 'female' && styles.genderCardSelected]}
            onPress={() => onGenderChange('female')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="female"
              size={ms(28)}
              color={gender === 'female' ? colors.accent : colors.textSecondary}
            />
            <Text style={[styles.genderLabel, gender === 'female' && styles.genderLabelSelected]}>
              Female
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Age */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Age</Text>
        <UnitInput
          placeholder="e.g. 24"
          value={age}
          onChangeText={onAgeChange}
          keyboardType="number-pad"
          maxLength={3}
          unit="yrs"
        />
      </View>

      {/* Height */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Height</Text>
        <UnitInput
          placeholder="e.g. 178"
          value={height}
          onChangeText={onHeightChange}
          keyboardType="number-pad"
          maxLength={3}
          unit="cm"
        />
      </View>

      {/* Weight */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Weight</Text>
        <UnitInput
          placeholder="e.g. 75"
          value={weight}
          onChangeText={onWeightChange}
          keyboardType="decimal-pad"
          maxLength={5}
          unit="kg"
        />
      </View>

      {/* Activity level */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Activity level</Text>
        <View style={styles.activityList}>
          {ACTIVITY_OPTIONS.map((opt) => {
            const selected = activity === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.activityCard, selected && styles.activityCardSelected]}
                onPress={() => onActivityChange(opt.key)}
                activeOpacity={0.7}
              >
                <View style={styles.activityTextWrap}>
                  <Text style={[styles.activityLabel, selected && styles.activityLabelSelected]}>
                    {opt.label}
                  </Text>
                  <Text style={styles.activityDescription}>{opt.description}</Text>
                </View>
                {selected && (
                  <Ionicons name="checkmark-circle" size={ms(20)} color={colors.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    detailsStack: {
      gap: sw(20),
    },
    fieldGroup: {
      gap: sw(8),
    },
    fieldLabel: {
      color: colors.textSecondary,
      fontSize: ms(14),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },

    /* ─── Username ─────────────────────────────────────────── */
    usernameInputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      backgroundColor: colors.card,
      borderRadius: sw(12),
      paddingHorizontal: sw(14),
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    usernameInput: {
      flex: 1,
      paddingVertical: sw(14),
      color: colors.textPrimary,
      fontSize: ms(16),
      lineHeight: ms(22),
      fontFamily: Fonts.medium,
    },
    usernameHint: {
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
      marginLeft: sw(4),
    },

    /* ─── Gender ───────────────────────────────────────────── */
    genderRow: {
      flexDirection: 'row',
      gap: sw(12),
    },
    genderCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: sw(14),
      paddingVertical: sw(18),
      alignItems: 'center',
      justifyContent: 'center',
      gap: sw(8),
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
    genderCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    genderLabel: {
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    genderLabelSelected: {
      color: colors.textPrimary,
    },

    /* ─── Activity selector ────────────────────────────────── */
    activityList: {
      gap: sw(8),
    },
    activityCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: sw(12),
      backgroundColor: colors.card,
      borderRadius: sw(12),
      paddingVertical: sw(12),
      paddingHorizontal: sw(14),
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
    activityCardSelected: {
      borderColor: colors.accent,
      backgroundColor: colors.surface,
    },
    activityTextWrap: {
      flex: 1,
      gap: sw(2),
    },
    activityLabel: {
      color: colors.textSecondary,
      fontSize: ms(15),
      lineHeight: ms(20),
      fontFamily: Fonts.semiBold,
    },
    activityLabelSelected: {
      color: colors.textPrimary,
    },
    activityDescription: {
      color: colors.textTertiary,
      fontSize: ms(12),
      lineHeight: ms(16),
      fontFamily: Fonts.medium,
    },
  });

export default memo(DetailsStep);
