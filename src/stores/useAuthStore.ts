import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { cleanupNotifications } from '../services/notificationService';
import { useWorkoutStore } from './useWorkoutStore';
import { clearWorkout as clearStoredWorkout } from '../utils/workoutStorage';

/** Module-level ref so we can unsubscribe on signOut */
let _authSubscription: { unsubscribe: () => void } | null = null;

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
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const { _pendingWelcome } = get();
      if (session?.user && _pendingWelcome) {
        set({ user: session.user, session, showWelcome: true, _pendingWelcome: false });
      } else {
        set({ user: session?.user ?? null, session });
      }
      if (session?.user) {
        await get().fetchProfile(session.user.id);
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
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        set({ _pendingWelcome: false });
        return { error: error.message };
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

        // Create default nutrition goals
        await supabase.from('nutrition_goals').upsert({
          user_id: data.user.id,
          calorie_goal: 2000,
          protein_goal: 150,
          carbs_goal: 250,
          fat_goal: 65,
        }, { onConflict: 'user_id' });

        // Create default supplement goals
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

  signOut: async () => {
    cleanupNotifications();
    // Release heavy caches held by stores
    useWorkoutStore.getState().clearCaches();
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
    useWorkoutStore.getState().clearCaches();
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
