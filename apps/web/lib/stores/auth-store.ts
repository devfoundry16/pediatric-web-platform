"use client";

import { create } from "zustand";
import { isAuthRetryableFetchError, type AuthError, type User, type Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AUTH_ERROR_CODES } from "@/lib/i18n/error-message";

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  /** An error code, not a message: display it with getAuthErrorMessage(). */
  error: string | null;
}

interface AuthActions {
  signIn: (email: string, password: string) => Promise<void>;
  /** `redirectTo` is a same-origin path to land on after the OAuth round trip. */
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
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
  // The `error` these return is a code, as with AuthState.error.
  updateUserEmail: (email: string) => Promise<{ error: string | null }>;
  updateUserPassword: (password: string) => Promise<{ error: string | null }>;
}

type AuthStore = AuthState & AuthActions;

/**
 * Sentinel stored in `error` when sign-in is refused because the account was
 * deactivated.
 */
export const ACCOUNT_DEACTIVATED = AUTH_ERROR_CODES.accountDeactivated;

/**
 * The store has no access to the i18n dictionary, so it keeps Supabase's error
 * code and the UI translates it (getAuthErrorMessage). Supabase's messages are
 * English-only.
 */
function errorCode(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) return "network";
  return error.code ?? "unexpected_failure";
}

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
      // Deactivating an account bans it in auth.users. Older Supabase
      // versions report that without the user_banned code.
      set({
        isLoading: false,
        error: /banned/i.test(error.message) ? ACCOUNT_DEACTIVATED : errorCode(error),
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

  signInWithGoogle: async (redirectTo) => {
    const supabase = createClient();
    set({ isLoading: true, error: null });

    // Carry the intended destination through the round trip. Someone opening a
    // consultation link while signed out is sent to the login form with
    // ?redirectTo=; without passing it on, signing in with Google would drop
    // them on their dashboard and lose the meeting they were trying to join.
    // The callback only honours same-origin paths (see auth/callback/route.ts).
    const callback = new URL("/auth/callback", window.location.origin);
    if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) {
      callback.searchParams.set("next", redirectTo);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Land on the existing PKCE callback, which exchanges the code for a
        // session and routes the user on. Google users are created as parents
        // (migration 012) with an empty phone.
        redirectTo: callback.toString(),
      },
    });

    // On success the browser is redirected to Google's consent screen, so no
    // further state update runs here. Only surface a failure to start the flow.
    if (error) {
      set({ isLoading: false, error: errorCode(error) });
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
      set({ isLoading: false, error: errorCode(error) });
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
      set({ isLoading: false, error: errorCode(error) });
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
      return { error: AUTH_ERROR_CODES.notSignedIn };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        full_name: fullName,
        phone,
      },
    });

    if (error) {
      return { error: errorCode(error) };
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
      return { error: errorCode(error) };
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
      return { error: errorCode(error) };
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
