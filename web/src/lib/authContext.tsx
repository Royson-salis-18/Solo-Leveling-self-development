import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabase";
import { ErrorHandler, AppErrorException } from "./errorHandler";
import type { AppError } from "./errorHandler";
import { logger } from "./logger";
import { rpc } from "./rpc";
import type { ProfileSnapshot } from "./gameTypes";
import type { User } from "@supabase/supabase-js";

/** Your own profile row (the only row `user_profiles` returns to you; others come from public_profiles). */
export type UserProfile = ProfileSnapshot & {
  user_id: string;
  email: string;
  name: string;
  hunter_code?: string;
  avatar_url?: string | null;
  bio?: string | null;
  age?: number | null;
  player_class: string;
  player_job?: string | null;
  monarch_allegiance?: string | null;
  weapon_of_choice?: string | null;
  gear_style?: string | null;
  guild_id?: string | null;
  clan_id?: string | null;
  guild_title?: string | null;
  guild_logo?: string | null;
  guild_aura_card?: string | null;
  timezone: string;
  mode_selected_at: string | null;
  streak_freezes?: number;
  best_streak?: number;
  last_active_date?: string | null;
  season_end_date?: string | null;
  domain_physical?: number;
  domain_mind?: number;
  domain_soul?: number;
  domain_execution?: number;
  domain_builder?: number;
  created_at?: string;
};

/** The only columns a player may edit themselves; everything else is server-owned. */
export type CosmeticProfileUpdate = Partial<Pick<UserProfile,
  "name" | "bio" | "avatar_url" | "age" | "player_class" | "player_job" | "monarch_allegiance" |
  "weapon_of_choice" | "gear_style" | "guild_aura_card" | "guild_logo">>;

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** True while the user arrived from a password-reset email and must choose a new password. */
  isRecovering: boolean;
  error: AppError | null;
  signUp: (email: string, password: string, name: string, playerClass?: string, referralCode?: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (updates: CosmeticProfileUpdate) => Promise<void>;
  /** Merge server-returned numbers (XP, level, streak…) into the cached profile without a refetch. */
  applyProfilePatch: (patch: Partial<UserProfile>) => void;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecovering, setIsRecovering] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const tzSynced = useRef<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  /** Fetch my profile row. Never throws and never blocks the UI. */
  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    try {
      let { data, error: err } = await supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (err) { logger.warn("Profile fetch failed", { code: err.code }); return; }

      if (!data) {
        // Sign-up trigger normally creates it; heal the rare missing-row case server-side.
        try { await rpc("ensure_profile"); } catch { /* table not migrated yet etc. */ }
        ({ data } = await supabase.from("user_profiles").select("*").eq("user_id", userId).maybeSingle());
      }
      if (!data) return;
      setProfile(data as UserProfile);

      // "Today" is the player's local day. Keep the server's idea of it in step with the browser.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && data.timezone !== tz && tzSynced.current !== tz) {
        tzSynced.current = tz;
        rpc("set_timezone", { p_tz: tz })
          .then(() => setProfile((p) => (p ? { ...p, timezone: tz } : p)))
          .catch((e) => logger.warn("set_timezone failed", { e }));
      }
    } catch (e) {
      logger.warn("fetchProfile: non-critical error", { e });
    }
  }, []);

  /**
   * Initialize auth state and listen for changes.
   *
   * IMPORTANT: never `await` another Supabase call inside the onAuthStateChange callback —
   * supabase-js holds an internal lock while it runs, so awaiting a query there can deadlock
   * and (as it did here) stalled the whole app behind the 5s profile timeout. We resolve
   * "loading" as soon as the session is known and hydrate the profile in the background.
   */
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger.debug("Auth state changed", { event, hasSession: !!session });
      if (event === "PASSWORD_RECOVERY") setIsRecovering(true);
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      setIsLoading(false);

      if (!nextUser) {
        setProfile(null);
        return;
      }
      // Token refreshes don't change the profile; everything else re-hydrates it, deferred out
      // of the auth callback.
      if (event !== "TOKEN_REFRESHED") {
        setTimeout(() => { void fetchProfile(nextUser.id); }, 0);
      }
    });

    // Safety net for older sessions that don't emit INITIAL_SESSION.
    supabase.auth.getSession().then(({ data, error: err }) => {
      if (err) logger.error("getSession error", {}, err as Error);
      if (err || !data.session) setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const fail = useCallback((appError: AppError): never => {
    setError(appError);
    throw new AppErrorException(appError);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, playerClass: string = "Warrior", referralCode?: string) => {
    const emailValidation = ErrorHandler.validateEmail(email);
    if (!emailValidation.valid) fail(emailValidation.error!);
    const passwordValidation = ErrorHandler.validatePassword(password);
    if (!passwordValidation.valid) fail(passwordValidation.error!);
    if (!name.trim()) fail(ErrorHandler.logError("VALIDATION_ERROR", "Name is required", { field: "name" }));
    if (!supabase) fail(ErrorHandler.logError("SUPABASE_NOT_INITIALIZED", "Supabase not initialized", {}));

    clearError();
    try {
      const { data, error: authError } = await supabase!.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim(), player_class: playerClass, ...(referralCode ? { ref: referralCode } : {}) } },
      });
      if (authError) throw authError;
      if (!data.user) throw new Error("Failed to create user account");

      // With email confirmation enabled Supabase returns a user but NO session. Treating that user
      // as signed in (as this used to) leaves the app with no JWT, so every call fails.
      if (!data.session) return { needsEmailConfirmation: true };
      return { needsEmailConfirmation: false };
    } catch (err) {
      logger.error("Registration failed", {}, err as Error);
      return fail(ErrorHandler.handleSupabaseError(err, "signUp"));
    }
  }, [clearError, fail]);

  const signIn = useCallback(async (email: string, password: string) => {
    const emailValidation = ErrorHandler.validateEmail(email);
    if (!emailValidation.valid) fail(emailValidation.error!);
    const passwordValidation = ErrorHandler.validatePassword(password);
    if (!passwordValidation.valid) fail(passwordValidation.error!);
    if (!supabase) fail(ErrorHandler.logError("SUPABASE_NOT_INITIALIZED", "Supabase not initialized", {}));

    clearError();
    try {
      const { data, error: err } = await supabase!.auth.signInWithPassword({ email, password });
      if (err) throw err;
      if (!data.user) throw new Error("Failed to sign in");
      // onAuthStateChange sets the user and hydrates the profile; no loading flicker here.
    } catch (err) {
      logger.error("Login failed", {}, err as Error);
      fail(ErrorHandler.handleSupabaseError(err, "signIn"));
    }
  }, [clearError, fail]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    clearError();
    try {
      const { error: err } = await supabase.auth.signOut();
      if (err) throw err;
      setUser(null);
      setProfile(null);
    } catch (err) {
      logger.error("Logout failed", {}, err as Error);
      fail(ErrorHandler.handleSupabaseError(err, "signOut"));
    }
  }, [clearError, fail]);

  const resetPassword = useCallback(async (email: string) => {
    const v = ErrorHandler.validateEmail(email);
    if (!v.valid) fail(v.error!);
    if (!supabase) fail(ErrorHandler.logError("SUPABASE_NOT_INITIALIZED", "Supabase not initialized", {}));
    try {
      const { error: err } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
    } catch (err) {
      fail(ErrorHandler.handleSupabaseError(err, "resetPassword"));
    }
  }, [fail]);

  const updatePassword = useCallback(async (newPassword: string) => {
    const v = ErrorHandler.validatePassword(newPassword);
    if (!v.valid) fail(v.error!);
    if (!supabase) fail(ErrorHandler.logError("SUPABASE_NOT_INITIALIZED", "Supabase not initialized", {}));
    try {
      const { error: err } = await supabase!.auth.updateUser({ password: newPassword });
      if (err) throw err;
      setIsRecovering(false);
    } catch (err) {
      fail(ErrorHandler.handleSupabaseError(err, "updatePassword"));
    }
  }, [fail]);

  const updateProfile = useCallback(async (updates: CosmeticProfileUpdate) => {
    if (!user || !supabase) fail(ErrorHandler.logError("AUTH_NOT_AUTHENTICATED", "User not authenticated", {}));
    try {
      const { data, error: err } = await supabase!.from("user_profiles").update(updates).eq("user_id", user!.id).select().single();
      if (err) throw err;
      setProfile(data as UserProfile);
    } catch (err) {
      logger.error("Failed to update profile", { userId: user!.id }, err as Error);
      fail(ErrorHandler.handleSupabaseError(err, "updateProfile"));
    }
  }, [user, fail]);

  const applyProfilePatch = useCallback((patch: Partial<UserProfile>) => {
    setProfile((p) => (p ? { ...p, ...patch } : p));
  }, []);

  const refreshProfile = useCallback(
    () => (user ? fetchProfile(user.id) : Promise.resolve()),
    [user, fetchProfile],
  );

  // Memoised so consumers only re-render when auth state actually changes.
  const value = useMemo<AuthContextType>(() => ({
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    isRecovering,
    error,
    signUp, signIn, signOut, resetPassword, updatePassword, updateProfile,
    applyProfilePatch, refreshProfile, clearError,
  }), [user, profile, isLoading, isRecovering, error, signUp, signIn, signOut, resetPassword, updatePassword,
       updateProfile, applyProfilePatch, refreshProfile, clearError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
