import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 10;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldStatus = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

/** What a username field keeps of what was typed: no whitespace, at most USERNAME_MAX characters. */
export const cleanUsernameInput = (value: string) => value.replace(/\s/g, '').slice(0, USERNAME_MAX);

interface CheckOptions {
  /** Status to show when the availability RPC fails ('ok' = fail open, 'idle' = block). */
  errorStatus: 'ok' | 'idle';
  /** When false the check doesn't run and the status stays at `initialStatus`. */
  enabled?: boolean;
  initialStatus?: FieldStatus;
}

const CHECKS = {
  username: {
    delayMs: 400,
    normalise: (v: string) => v.trim(),
    isValid: (v: string) => v.length >= USERNAME_MIN && v.length <= USERNAME_MAX && USERNAME_REGEX.test(v),
  },
  email: {
    delayMs: 500,
    normalise: (v: string) => v.trim().toLowerCase(),
    isValid: (v: string) => EMAIL_REGEX.test(v),
  },
} as const;

/** Debounced `username_or_email_taken` check for one field. */
function useTakenCheck(
  kind: keyof typeof CHECKS,
  raw: string,
  { errorStatus, enabled = true, initialStatus = 'idle' }: CheckOptions,
): FieldStatus {
  const [status, setStatus] = useState<FieldStatus>(initialStatus);

  useEffect(() => {
    if (!enabled) return;
    const check = CHECKS[kind];
    const value = check.normalise(raw);
    if (value.length === 0) {
      setStatus('idle');
      return;
    }
    if (!check.isValid(value)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    const handle = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_or_email_taken', {
        p_username: kind === 'username' ? value : '',
        p_email: kind === 'email' ? value : '',
      });
      if (error) {
        setStatus(errorStatus);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      const taken = kind === 'username' ? row?.username_taken : row?.email_taken;
      setStatus(taken ? 'taken' : 'ok');
    }, check.delayMs);
    return () => clearTimeout(handle);
  }, [kind, raw, enabled, errorStatus]);

  return status;
}

/** Availability of a username (3–10 letters, digits or underscores), checked 400 ms after typing stops. */
export function useUsernameAvailability(username: string, options: CheckOptions): FieldStatus {
  return useTakenCheck('username', username, options);
}

/** Whether an email is valid and not already registered, checked 500 ms after typing stops. */
export function useEmailAvailability(email: string, options: CheckOptions): FieldStatus {
  return useTakenCheck('email', email, options);
}
