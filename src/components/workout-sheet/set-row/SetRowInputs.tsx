import React, { useCallback, useRef } from 'react';
import { TextInput, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../theme/useColors';
import { sw, ms } from '../../../theme/responsive';
import { type ExerciseType } from '../../../utils/exerciseProgress';
import { showsKg, isTimedType } from '../summary/summaryFormat';
import { formatCountdown } from '../../../utils/formatDuration';
import type { SetRowStyles } from './setRowStyles';

/** A seconds string (as typed) as m:ss; empty or invalid shows 0:00. */
export const formatTimeDisplay = (secs: string) => formatCountdown(parseInt(secs, 10) || 0);

interface Props {
  styles: SetRowStyles;
  index: number;
  /** The store's values, compared on blur. */
  setKg: string;
  setReps: string;
  localKg: string;
  localReps: string;
  setLocalKg: (v: string) => void;
  setLocalReps: (v: string) => void;
  suggestedKg?: string;
  suggestedReps?: string;
  exerciseType?: ExerciseType;
  completed: boolean;
  /** Ghost-mode result colour for completed text; null uses the normal completed style. */
  ghostColor: string | null;
  onUpdate: (index: number, field: 'kg' | 'reps', value: string) => void;
  onInputFocus?: (y: number) => void;
}

/** The kg input and the reps (±1) or duration (±15 s) input of a set row. */
function SetRowInputs({
  styles, index, setKg, setReps, localKg, localReps, setLocalKg, setLocalReps,
  suggestedKg, suggestedReps, exerciseType, completed, ghostColor, onUpdate, onInputFocus,
}: Props) {
  const colors = useColors();
  const kgRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);

  const handleFocus = useCallback((inputRef: React.RefObject<TextInput | null>, value: string) => {
    if (value.length > 0 && inputRef.current) {
      inputRef.current.setNativeProps({ selection: { start: 0, end: value.length } });
    }
    if (onInputFocus && inputRef.current) {
      (inputRef.current as any).measureInWindow((_x: number, y: number) => {
        onInputFocus(y);
      });
    }
  }, [onInputFocus]);

  /** Steps reps (or seconds) by delta; a step down never goes below 0. */
  const stepReps = (delta: number) => {
    const cur = parseInt(localReps, 10) || 0;
    const next = cur + delta;
    if (delta < 0 && next < 0) return;
    const v = String(next);
    setLocalReps(v);
    onUpdate(index, 'reps', v);
  };

  const completedTextStyle = completed && (ghostColor ? { color: ghostColor } : styles.inputTextCompleted);

  const stepButton = (delta: number, icon: 'remove' | 'add') => (
    <TouchableOpacity style={styles.repStepBtn} onPress={() => stepReps(delta)} activeOpacity={0.5}>
      <Ionicons name={icon} size={ms(12)} color={colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <>
      {/* KG input — only for weighted / weighted+bodyweight */}
      {showsKg(exerciseType) && (
        <View style={[styles.inputContainer, completed && styles.inputContainerCompleted, !localKg && suggestedKg && styles.inputContainerSuggested]}>
          <TextInput
            ref={kgRef}
            style={[styles.input, completedTextStyle]}
            value={localKg}
            onChangeText={(text) => {
              // Comma-decimal keyboards type '80,5', which parseFloat reads as 80
              const v = text.replace(',', '.');
              setLocalKg(v);
              onUpdate(index, 'kg', v);
            }}
            onFocus={() => handleFocus(kgRef, localKg)}
            onBlur={() => { if (localKg !== setKg) onUpdate(index, 'kg', localKg); }}
            placeholder={suggestedKg || '—'}
            placeholderTextColor={suggestedKg ? colors.textSecondary : colors.textTertiary + '50'}
            keyboardType="decimal-pad"
            editable={!completed}
          />
        </View>
      )}

      {/* DURATION input — time in seconds with +/- 15s steppers */}
      {isTimedType(exerciseType) ? (
        <View style={[styles.repsRow, { flex: 2 }, completed && styles.repsRowCompleted]}>
          {!completed && stepButton(-15, 'remove')}
          <View style={styles.timeDisplay}>
            <Ionicons name="timer-outline" size={ms(11)} color={completed ? colors.accentGreen : colors.textTertiary} style={{ marginRight: sw(3) }} />
            <TextInput
              ref={repsRef}
              style={[styles.repsInput, completedTextStyle]}
              value={localReps ? formatTimeDisplay(localReps) : ''}
              onChangeText={(v) => {
                // Strip non-numeric, treat raw input as seconds
                const raw = v.replace(/[^0-9]/g, '');
                setLocalReps(raw);
                onUpdate(index, 'reps', raw);
              }}
              onFocus={() => handleFocus(repsRef, localReps)}
              onBlur={() => { if (localReps !== setReps) onUpdate(index, 'reps', localReps); }}
              placeholder="0:00"
              placeholderTextColor={colors.textTertiary + '50'}
              keyboardType="number-pad"
              editable={!completed}
            />
          </View>
          {!completed && stepButton(15, 'add')}
        </View>
      ) : (
        /* REPS input with +/- 1 steppers */
        <View style={[styles.repsRow, completed && styles.repsRowCompleted, !localReps && suggestedReps && styles.repsRowSuggested]}>
          {!completed && stepButton(-1, 'remove')}
          <TextInput
            ref={repsRef}
            style={[styles.repsInput, completedTextStyle]}
            value={localReps}
            onChangeText={(v) => { setLocalReps(v); onUpdate(index, 'reps', v); }}
            onFocus={() => handleFocus(repsRef, localReps)}
            onBlur={() => { if (localReps !== setReps) onUpdate(index, 'reps', localReps); }}
            placeholder={suggestedReps || '—'}
            placeholderTextColor={suggestedReps ? colors.textSecondary : colors.textTertiary + '50'}
            keyboardType="number-pad"
            editable={!completed}
          />
          {!completed && stepButton(1, 'add')}
        </View>
      )}
    </>
  );
}

export default React.memo(SetRowInputs);
