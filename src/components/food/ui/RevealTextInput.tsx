import React, { forwardRef, useCallback } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useRevealOnFocus } from './FoodSubScreen';

type FocusEvent = Parameters<NonNullable<TextInputProps['onFocus']>>[0];

/** A TextInput that scrolls itself above the keyboard when focused inside a FoodSubScreen. */
const RevealTextInput = forwardRef<TextInput, TextInputProps>(function RevealTextInput({ onFocus, ...rest }, ref) {
  const reveal = useRevealOnFocus();
  const handleFocus = useCallback((e: FocusEvent) => {
    reveal();
    onFocus?.(e);
  }, [reveal, onFocus]);
  return <TextInput ref={ref} {...rest} onFocus={handleFocus} />;
});

export default RevealTextInput;
