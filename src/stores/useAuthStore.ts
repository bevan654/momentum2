import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';
import { cleanupNotifications } from '../services/notificationService';
import { useWorkoutStore } from './useWorkoutStore';

const PROFILE_CACHE_KEY = 'momentum_profile_cache';

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
    // Load cached profile immediately so UI can render while network fetches
    try {
      const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
      if (cached) set({ profile: JSON.parse(cached) as Profile });
    } catch {}

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        set({ user: session.user, session, initialized: true });
        // Refresh profile from network in background
        get().fetchProfile(session.user.id);
      } else {
        set({ initialized: true });
      }
    } catch {
      // Offline or session expired — cached profile already loaded above
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
      .select('id, email, username, height, age, gender, starting_weight, goal_weight, share_workouts, show_streak, notifications_enabled, leaderboard_opt_in')
      .eq('id', userId)
      .single();

    if (data) {
      const profile: Profile = {
        ...data,
        share_workouts: data.share_workouts ?? true,
        show_streak: data.show_streak ?? true,
        notifications_enabled: data.notifications_enabled ?? true,
        leaderboard_opt_in: data.leaderboard_opt_in ?? true,
      };
      set({ profile });
      AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile)).catch(() => {});
    } else if (!get().profile) {
      // Network failed or no data — fall back to cached profile
      try {
        const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) set({ profile: JSON.parse(cached) as Profile });
      } catch {}
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
    AsyncStorage.removeItem(PROFILE_CACHE_KEY).catch(() => {});
    await supabase.auth.signOut();
    set({ user: null, session: null, profile: null, showWelcome: false, _pendingWelcome: false });
  },

  dismissWelcome: () => {
    set({ showWelcome: false });
  },
}));
