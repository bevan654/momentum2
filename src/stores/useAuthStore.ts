import { create } from 'zustand';
import { rebuildClient, supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { cleanupNotifications, stopPushToken } from '../services/notificationService';
import { useWorkoutStore } from './useWorkoutStore';
import { useActiveWorkoutStore } from './useActiveWorkoutStore';
import { clearWorkout as clearStoredWorkout } from '../utils/workoutStorage';
import { AppState, Linking } from 'react-native';

type SocialProvider = 'google' | 'apple';

const OAUTH_REDIRECT_URL = 'momentum://auth/callback';

const isFetchCancelledError = (error: unknown): boolean =>
  error instanceof Error && /fetch cancel(?:l)?ed/i.test(error.message);

/**
 * iOS can deliver the OAuth deep link while the app is still transitioning
 * from Safari through `inactive` to `active`. A native `expo/fetch` started in
 * that window is cancelled by the OS, so wait for the app to finish resuming
 * before Supabase validates and persists the returned session.
 */
function waitForAppActive(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') finish();
    });
    // The app should become active almost immediately after the deep link. Do
    // not leave the auth UI hanging indefinitely if iOS misses the event.
    const timeout = setTimeout(finish, 5_000);
  });
}

async function setOAuthSession(accessToken: string, refreshToken: string) {
  await waitForAppActive();

  try {
    const result = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (!result.error || !isFetchCancelledError(result.error)) return result;
  } catch (error) {
    if (!isFetchCancelledError(error)) throw error;
  }

  // A request that began during the Safari -> app transition can leave the
  // native fetch task/client lock in a cancelled state. Rebuild once and retry
  // with the same valid OAuth tokens after the app is fully active.
  rebuildClient();
  await waitForAppActive();
  await new Promise((resolve) => setTimeout(resolve, 250));
  return supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
}

const socialProviderLabel = (provider: SocialProvider) =>
  provider === 'google' ? 'Google' : 'Apple';

function getSocialAuthErrorMessage(
  provider: SocialProvider,
  code: string | null | undefined,
  fallback?: string | null,
): string {
  const label = socialProviderLabel(provider);
  switch (code) {
    case 'email_exists':
    case 'user_already_exists':
    case 'identity_already_exists':
      return `An account already exists for this email and could not be safely linked to ${label}. Sign in using the method you originally used.`;
    case 'provider_email_needs_verification':
      return `${label} did not provide a verified email. Verify your email with ${label}, then try again.`;
    case 'flow_state_expired':
    case 'flow_state_not_found':
      return 'This sign-in attempt expired. Please try again.';
    case 'provider_disabled':
    case 'oauth_provider_not_supported':
      return `${label} sign in is not enabled yet.`;
    default:
      return fallback || `${label} sign in failed. Please try again.`;
  }
}

function waitForOAuthCallback(): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve(url);
    };
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(OAUTH_REDIRECT_URL)) finish(url);
    });
    const timeout = setTimeout(() => finish(null), 5 * 60 * 1000);
  });
}

/** Module-level ref so we can unsubscribe on signOut */
let _authSubscription: { unsubscribe: () => void } | null = null;

/**
 * After a verified sign-in, create the profile + default goal rows. Password
 * sign-up supplies its username through metadata; social users intentionally
 * start without one so onboarding can ask them to choose it. Idempotent: skips
 * users whose profile is already ready.
 */
async function ensureProfileFromMetadata(user: User): Promise<void> {
  const metadata = user.user_metadata as Record<string, any> | null;
  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  if (existing?.username) return;

  const username = metadata?.username ?? null;

  await supabase.from('profiles').upsert(
    { id: user.id, email: user.email, username },
    { onConflict: 'id' },
  );
  await supabase.from('nutrition_goals').upsert(
    {
      user_id: user.id,
      calorie_goal: 2000,
      protein_goal: 150,
      carbs_goal: 250,
      fat_goal: 65,
    },
    { onConflict: 'user_id' },
  );
  await supabase.from('supplement_goals').upsert(
    { user_id: user.id, water_goal: 2500, creatine_goal: 5 },
    { onConflict: 'user_id' },
  );
}

interface Profile {
  id: string;
  email: string;
  username: string | null;
  height: number | null;
  age: number | null;
  gender: string | null;
  starting_weight: number | null;
  goal_weight: number | null;
  share_workouts: boolean;
  show_streak: boolean;
  notifications_enabled: boolean;
  leaderboard_opt_in: boolean;
  ai_coach_enabled: boolean;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  initialized: boolean;
  showWelcome: boolean;
  _pendingWelcome: boolean;
  initialize: () => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null; needsVerification?: boolean }>;
  verifyOtp: (email: string, token: string) => Promise<{ error: string | null }>;
  resendOtp: (email: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithSocial: (provider: SocialProvider) => Promise<{ error: string | null; cancelled?: boolean }>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<{ error: string | null }>;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<Omit<Profile, 'id' | 'email'>>) => Promise<void>;
  dismissWelcome: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: false,
  initialized: false,
  showWelcome: false,
  _pendingWelcome: false,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, session });
        await ensureProfileFromMetadata(session.user);
        await get().fetchProfile(session.user.id);
      }
    } finally {
      set({ initialized: true });
    }

    // Unsubscribe previous listener if re-initializing
    if (_authSubscription) {
      _authSubscription.unsubscribe();
      _authSubscription = null;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const { _pendingWelcome } = get();
      // Signed out without signOut() (an expired session) or switched accounts:
      // the active workout belongs to the previous account. Its saved copy stays
      // and comes back if that account signs in again.
      const prevUserId = get().user?.id;
      if (prevUserId && prevUserId !== session?.user?.id) {
        useActiveWorkoutStore.getState().resetForSignOut();
      }
      if (session?.user && _pendingWelcome) {
        set({ user: session.user, session, showWelcome: true, _pendingWelcome: false });
      } else {
        set({ user: session?.user ?? null, session });
      }
      if (session?.user) {
        // Supabase warns against awaiting other auth/database calls inside this
        // callback because the originating auth operation may still hold its
        // internal lock. Defer profile bootstrap until the callback has returned.
        const user = session.user;
        setTimeout(() => {
          void (async () => {
            await ensureProfileFromMetadata(user);
            await get().fetchProfile(user.id);
          })();
        }, 0);
      } else {
        set({ profile: null, showWelcome: false });
      }
    });
    _authSubscription = subscription;
  },

  fetchProfile: async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, username, height, age, gender, starting_weight, goal_weight, share_workouts, show_streak, notifications_enabled, leaderboard_opt_in, ai_coach_enabled')
      .eq('id', userId)
      .single();

    if (data) {
      set({
        profile: {
          ...data,
          share_workouts: data.share_workouts ?? true,
          show_streak: data.show_streak ?? true,
          notifications_enabled: data.notifications_enabled ?? true,
          leaderboard_opt_in: data.leaderboard_opt_in ?? true,
          ai_coach_enabled: data.ai_coach_enabled ?? false,
        } as Profile,
      });
    }
  },

  updateProfile: async (updates) => {
    const { profile } = get();
    if (!profile) return;

    // Optimistic update
    set({ profile: { ...profile, ...updates } });

    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id);

    if (error) {
      // Rollback
      set({ profile });
    }
  },

  signUp: async (email, password, username) => {
    set({ loading: true, _pendingWelcome: true });
    try {
      // Stash username in user_metadata so we can recreate the profile after
      // email verification, when the user signs in for the first time.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      });
      if (error) {
        set({ _pendingWelcome: false });
        return { error: error.message };
      }

      // Email verification enabled: signUp returns a user but no session.
      // Skip profile/goal creation; it will run when the user verifies and
      // signs in (handled in onAuthStateChange via ensureProfileFromMetadata).
      if (!data.session) {
        set({ _pendingWelcome: false });
        return { error: null, needsVerification: true };
      }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          username,
        }, { onConflict: 'id' });
        if (profileError) {
          set({ _pendingWelcome: false });
          return { error: profileError.message };
        }

        await supabase.from('nutrition_goals').upsert({
          user_id: data.user.id,
          calorie_goal: 2000,
          protein_goal: 150,
          carbs_goal: 250,
          fat_goal: 65,
        }, { onConflict: 'user_id' });

        await supabase.from('supplement_goals').upsert({
          user_id: data.user.id,
          water_goal: 2500,
          creatine_goal: 5,
        }, { onConflict: 'user_id' });

        await get().fetchProfile(data.user.id);
      }
      return { error: null };
    } finally {
      set({ loading: false });
    }
  },

  verifyOtp: async (email, token) => {
    set({ loading: true, _pendingWelcome: true });
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'signup',
      });
      if (error) {
        set({ _pendingWelcome: false });
        return { error: error.message };
      }
      return { error: null };
    } finally {
      set({ loading: false });
    }
  },

  resendOtp: async (email) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase(),
    });
    return { error: error?.message ?? null };
  },

  signIn: async (email, password) => {
    set({ loading: true, _pendingWelcome: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ _pendingWelcome: false });
        return { error: error.message };
      }
      return { error: null };
    } finally {
      set({ loading: false });
    }
  },

  signInWithSocial: async (provider) => {
    set({ loading: true, _pendingWelcome: true });
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: OAUTH_REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });
      if (error || !data.url) {
        set({ _pendingWelcome: false });
        return {
          error: getSocialAuthErrorMessage(provider, error?.code, error?.message),
        };
      }

      const callbackPromise = waitForOAuthCallback();
      await Linking.openURL(data.url);
      const callbackUrl = await callbackPromise;
      if (!callbackUrl) {
        set({ _pendingWelcome: false });
        return { error: null, cancelled: true };
      }

      const callbackParams = new URLSearchParams(
        callbackUrl.includes('#')
          ? callbackUrl.split('#')[1]
          : callbackUrl.split('?')[1] ?? '',
      );
      const callbackErrorCode = callbackParams.get('error_code') ?? callbackParams.get('error');
      const callbackError = callbackParams.get('error_description');
      if (callbackErrorCode || callbackError) {
        set({ _pendingWelcome: false });
        return {
          error: getSocialAuthErrorMessage(provider, callbackErrorCode, callbackError),
        };
      }

      const accessToken = callbackParams.get('access_token');
      const refreshToken = callbackParams.get('refresh_token');
      if (!accessToken || !refreshToken) {
        set({ _pendingWelcome: false });
        return { error: 'The provider did not return a valid session.' };
      }

      const { error: sessionError } = await setOAuthSession(accessToken, refreshToken);
      if (sessionError) {
        set({ _pendingWelcome: false });
        return {
          error: getSocialAuthErrorMessage(provider, sessionError.code, sessionError.message),
        };
      }
      return { error: null };
    } catch (error) {
      set({ _pendingWelcome: false });
      return { error: error instanceof Error ? error.message : 'Social sign in failed.' };
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    cleanupNotifications();
    stopPushToken();
    // Release heavy caches held by stores
    useWorkoutStore.getState().clearCaches();
    // Drop the active workout from memory; its saved copy only comes back for this account
    useActiveWorkoutStore.getState().resetForSignOut();
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, showWelcome: false, _pendingWelcome: false });
  },

  deleteAccount: async (password) => {
    const { profile, user } = get();
    if (!profile?.email || !user) {
      return { error: 'You must be signed in to delete your account.' };
    }

    // Re-authenticate to prove identity before destructive action.
    // signInWithPassword returns an error if the password is wrong; the existing
    // session stays valid either way, so a wrong guess just shows an error.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password,
    });
    if (reauthError) {
      return { error: 'Incorrect password. Please try again.' };
    }

    // Server-side deletion via Edge Function (uses service role + admin API).
    // The function reads the user_id from the JWT — we don't pass it.
    const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
      body: {},
    });
    if (__DEV__) console.log('[deleteAccount] invoke result:', { data, fnError });
    if (fnError) {
      return { error: fnError.message || 'Failed to delete account. Please try again.' };
    }
    // Require an explicit success flag from the function. Anything else (missing
    // function, partial failure, surprise response shape) means we did NOT
    // actually delete the account — never sign out in that case.
    if (!data || data.error || data.success !== true) {
      return {
        error: (data && data.error) || 'Account deletion did not complete. Please try again.',
      };
    }

    // Local cleanup. The auth user is gone server-side, so any token use will
    // 401 — clear caches + stored workout state so nothing leaks if a different
    // user signs in on this device.
    cleanupNotifications();
    stopPushToken();
    useWorkoutStore.getState().clearCaches();
    useActiveWorkoutStore.getState().resetForSignOut();
    try {
      clearStoredWorkout();
    } catch {
      // best-effort
    }
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, showWelcome: false, _pendingWelcome: false });
    return { error: null };
  },

  dismissWelcome: () => {
    set({ showWelcome: false });
  },

  requestPasswordReset: async (email) => {
    // resetPasswordForEmail always returns success so we don't leak whether the
    // email exists. The user gets the same "check your email" UX either way.
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) return { error: error.message };
    return { error: null };
  },

  confirmPasswordReset: async (email, code, newPassword) => {
    // Two-step: verify the recovery OTP to get a temporary session, then update
    // the password on that session. Sign out afterwards so the user lands on the
    // login screen and re-authenticates with the new password (cleaner mental
    // model than auto-routing into the app from a "reset" flow).
    const cleanedCode = code.trim();
    const cleanedEmail = email.trim().toLowerCase();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanedEmail,
      token: cleanedCode,
      type: 'recovery',
    });
    if (verifyError) {
      return { error: 'That code is invalid or has expired. Request a new one.' };
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      return { error: updateError.message };
    }
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, showWelcome: false, _pendingWelcome: false });
    return { error: null };
  },
}));
