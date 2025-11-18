import { create } from 'zustand';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface AuthState {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  initialize: async () => {
    if (!isSupabaseConfigured) {
      set({ initialized: true });
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      set({ user: session?.user ?? null, initialized: true });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ user: session?.user ?? null });
      });
    } catch (error) {
      console.error('Error initializing auth:', error);
      set({ initialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signUp: async (email: string, password: string) => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) throw error;
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Error initializing auth:', error);
        throw error;
      }
      set({ user: null });
    } finally {
      set({ loading: false });
    }
  },

  refreshUser: async () => {
    try {
      logger.debug('AuthStore', 'Refreshing user data');
      // Get current session first
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !currentSession) {
        logger.error('No session found:', sessionError);
        return;
      }
      
      // Force refresh the session - this fetches fresh user data from server
      // This is necessary because admin.updateUserById doesn't update the client-side session cache
      const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        logger.error('Error refreshing session:', refreshError);
        // Fallback: try getUser with current token
        if (currentSession.access_token) {
          const { data: { user: refreshedUser }, error: userError } = await supabase.auth.getUser(currentSession.access_token);
          if (!userError && refreshedUser) {
            logger.debug('AuthStore', 'User refreshed via getUser fallback');
            set({ user: refreshedUser });
            return;
          }
        }
        // Last resort: use current session
        if (currentSession.user) {
          logger.warn('Using current session (may be stale)');
          set({ user: currentSession.user });
        }
        return;
      }
      
      if (refreshedSession?.user) {
        logger.debug('AuthStore', 'User refreshed successfully');
        set({ user: refreshedSession.user });
      } else {
        logger.warn('No user in refreshed session');
        // Fallback to current session
        if (currentSession.user) {
          set({ user: currentSession.user });
        }
      }
    } catch (error) {
      logger.error('Error refreshing user:', error);
      // Fallback to getSession
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          set({ user: session.user });
        }
      } catch (fallbackError) {
        logger.error('Fallback refresh also failed:', fallbackError);
      }
    }
  },
}));

