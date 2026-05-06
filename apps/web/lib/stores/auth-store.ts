"use client";

import { create } from "zustand";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
    role: "parent" | "doctor"
  ) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  clearError: () => void;
  initialize: () => () => void;
  updateProfileMetadata: (
    fullName: string,
    phone: string
  ) => Promise<{ error: string | null }>;
  updateUserEmail: (email: string) => Promise<{ error: string | null }>;
  updateUserPassword: (password: string) => Promise<{ error: string | null }>;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  clearError: () => set({ error: null }),

  initialize: () => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Session could not be read or refreshed — treat as signed out.
        set({ session: null, user: null });
        return;
      }
      set({ session, user: session?.user ?? null });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESH_FAILED fires when the stored refresh token is revoked
      // or not found (e.g. after a long period of inactivity). Treat it the
      // same as SIGNED_OUT so the client state is fully cleared.
      if (event === "TOKEN_REFRESH_FAILED" || event === "SIGNED_OUT") {
        set({ session: null, user: null });
        return;
      }
      set({ session, user: session?.user ?? null });
    });

    return () => subscription.unsubscribe();
  },

  signIn: async (email, password) => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    set({ isLoading: false });
  },

  signUp: async (email, password, fullName, phone, role) => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role,
        },
      },
    });

    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    set({ isLoading: false });
  },

  signOut: async () => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    const { error } = await supabase.auth.signOut();

    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    set({ isLoading: false, user: null, session: null });
  },

  updateProfileMetadata: async (fullName, phone) => {
    const supabase = createClient();
    const {
      data: { user },
      error: getUserError,
    } = await supabase.auth.getUser();

    if (getUserError || !user) {
      return { error: "Not signed in" };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        full_name: fullName,
        phone,
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      set((state) => ({
        user: data.user,
        session: state.session
          ? { ...state.session, user: data.user }
          : null,
      }));
    }

    return { error: null };
  },

  updateUserEmail: async (email) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({ email });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      set((state) => ({
        user: data.user,
        session: state.session
          ? { ...state.session, user: data.user }
          : null,
      }));
    }

    return { error: null };
  },

  updateUserPassword: async (password) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      set((state) => ({
        user: data.user,
        session: state.session
          ? { ...state.session, user: data.user }
          : null,
      }));
    }

    return { error: null };
  },
}));
