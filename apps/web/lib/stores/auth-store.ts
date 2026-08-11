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
  signInWithGoogle: () => Promise<void>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    phone: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  clearError: () => void;
  initialize: () => () => void;
  updateProfileMetadata: (
    fullName: string,
    phone: string,
  ) => Promise<{ error: string | null }>;
  updateUserEmail: (email: string) => Promise<{ error: string | null }>;
  updateUserPassword: (password: string) => Promise<{ error: string | null }>;
}

type AuthStore = AuthState & AuthActions;

/**
 * Sentinel stored in `error` when sign-in is refused because the account was
 * deactivated. The store has no access to the i18n dictionary, so the form
 * translates this rather than showing a raw (English-only) Supabase message.
 */
export const ACCOUNT_DEACTIVATED = "ACCOUNT_DEACTIVATED";

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isLoading: false,
  error: null,

  setUser: (user) => set({ user }),

  setSession: (session) => set({ session, user: session?.user ?? null }),

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
      if (event === "SIGNED_OUT") {
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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Deactivating an account bans it in auth.users, which Supabase reports
      // as a generic error. Map it so the UI can localize it.
      set({
        isLoading: false,
        error: /banned/i.test(error.message) ? ACCOUNT_DEACTIVATED : error.message,
      });
      return;
    }

    // Accounts deactivated before the ban existed still authenticate, so check
    // the flag directly and drop the session that was just created.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile?.is_active === false) {
      await supabase.auth.signOut();
      set({ isLoading: false, error: ACCOUNT_DEACTIVATED, user: null, session: null });
      return;
    }

    set({ isLoading: false });
  },

  signInWithGoogle: async () => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Land on the existing PKCE callback, which exchanges the code for a
        // session and routes the user to their role-based dashboard. Google
        // users are created as parents (migration 012) with an empty phone.
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    // On success the browser is redirected to Google's consent screen, so no
    // further state update runs here. Only surface a failure to start the flow.
    if (error) {
      set({ isLoading: false, error: error.message });
    }
  },

  signUp: async (email, password, fullName, phone) => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Route the confirmation link to /auth/confirm, which verifies the
        // token_hash (no PKCE code_verifier needed) and lands the user on the
        // success page. Works cross-browser/device.
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/confirmed`,
        data: {
          full_name: fullName,
          phone,
          // Self-service signups are always parents; the DB enforces this too
          // (migration 012). Doctors/admins are provisioned by an admin.
          role: "parent",
        },
      },
    });

    if (error) {
      set({ isLoading: false, error: error.message });
      return;
    }

    if (data.session) {
      set({
        isLoading: false,
        session: data.session,
        user: data.session.user,
      });
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
        session: state.session ? { ...state.session, user: data.user } : null,
      }));
    }

    return { error: null };
  },

  updateUserEmail: async (email) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.updateUser(
      { email },
      {
        // The email-change confirmation link routes through /auth/confirm
        // (token_hash / verifyOtp) and lands on the same success page.
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/auth/confirmed`,
      },
    );

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      set((state) => ({
        user: data.user,
        session: state.session ? { ...state.session, user: data.user } : null,
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
        session: state.session ? { ...state.session, user: data.user } : null,
      }));
    }

    return { error: null };
  },
}));
