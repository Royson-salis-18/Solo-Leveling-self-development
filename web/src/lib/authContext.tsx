import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { ErrorHandler, AppErrorException } from "./errorHandler";
import type { AppError } from "./errorHandler";
import { logger } from "./logger";
import type { User } from "@supabase/supabase-js";

interface UserProfile {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  bio?: string;
  level: number;
  total_points: number;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: AppError | null;
  signUp: (email: string, password: string, name: string, playerClass?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  /**
   * Initialize auth state and listen for changes
   */
  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Set up auth state listener SYNCHRONOUSLY so React gets the cleanup fn
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        logger.debug("Auth state changed", { event: _event, hasSession: !!session });

        if (session?.user) {
          setUser(session.user);
          try {
            await fetchProfile(session.user.id);
          } catch (err) {
            logger.warn("Failed to fetch profile on auth change", { error: err });
          }
        } else {
          setUser(null);
          setProfile(null);
        }
        // Always resolve loading after first state change
        setIsLoading(false);
      }
    );

    // Seed the initial session (won't fire onAuthStateChange on its own)
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        logger.error("getSession error", {}, error as Error);
        setIsLoading(false);
        return;
      }
      if (!data.session) {
        // No session — stop loading so the login page shows
        setIsLoading(false);
      }
      // If there IS a session, onAuthStateChange will fire and set isLoading=false
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  /**
   * Fetch user profile from database — never throws, never hangs
   */
  const fetchProfile = async (userId: string) => {
    if (!supabase) return;

    try {
      // Race the query against a 5-second timeout
      const result = await Promise.race([
        supabase
          .from("user_profiles")
          .select("*")
          .eq("user_id", userId)
          .single(),
        new Promise<{ data: null; error: Error }>(resolve =>
          setTimeout(() => resolve({ data: null, error: new Error("timeout") }), 5000)
        ),
      ]);

      const { data, error } = result as { data: any; error: any };

      if (error) {
        // PGRST116 = row not found (new user, no profile yet) — totally fine
        // 42P01    = table doesn't exist yet — also fine, schema not run yet
        // timeout  — also fine
        logger.warn("Profile fetch skipped", { code: error.code ?? error.message });
        return;
      }

      if (data) {
        logger.info("Profile loaded", { userId, name: data.name });
        setProfile(data);
      }
    } catch {
      // swallow everything — profile is non-critical
      logger.warn("fetchProfile: non-critical error swallowed");
    }
  };

  /**
   * Register a new user
   */
  const signUp = async (email: string, password: string, name: string, playerClass: string = "Warrior") => {
    logger.info("📝 Starting user registration", { email, name, playerClass });

    // Validate inputs
    const emailValidation = ErrorHandler.validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error);
      throw new AppErrorException(emailValidation.error!);
    }

    const passwordValidation = ErrorHandler.validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error);
      throw new AppErrorException(passwordValidation.error!);
    }

    if (!name.trim()) {
      const err = ErrorHandler.logError(
        "VALIDATION_ERROR",
        "Name is required",
        { field: "name" }
      );
      setError(err);
      throw new AppErrorException(err);
    }

    if (!supabase) {
      const err = ErrorHandler.logError(
        "SUPABASE_NOT_INITIALIZED",
        "Supabase not initialized",
        {}
      );
      setError(err);
      throw new AppErrorException(err);
    }

    setIsLoading(true);
    clearError();

    try {
      logger.info("Creating auth user", { email });

      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, player_class: playerClass }
        }
      });

      if (authError) {
        throw authError;
      }

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      logger.info("✅ Auth user created", {
        userId: authData.user.id,
        email: authData.user.email,
      });

      // Note: The public.user_profiles row is created by the Supabase trigger trg_new_user
      // We just need to fetch it to populate the local state
      
      setUser(authData.user);
      await fetchProfile(authData.user.id);

      logger.info("✅ Registration completed successfully");
    } catch (err) {
      logger.error("Registration failed", { email }, err as Error);
      const appError = ErrorHandler.handleSupabaseError(err, "signUp");
      setError(appError);
      throw new AppErrorException(appError);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign in user with email and password
   */
  const signIn = async (email: string, password: string) => {
    logger.info("🔓 Attempting login", { email });

    // Validate inputs
    const emailValidation = ErrorHandler.validateEmail(email);
    if (!emailValidation.valid) {
      setError(emailValidation.error);
      throw new AppErrorException(emailValidation.error!);
    }

    const passwordValidation = ErrorHandler.validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.error);
      throw new AppErrorException(passwordValidation.error!);
    }

    if (!supabase) {
      const err = ErrorHandler.logError(
        "SUPABASE_NOT_INITIALIZED",
        "Supabase not initialized",
        {}
      );
      setError(err);
      throw new AppErrorException(err);
    }

    setIsLoading(true);
    clearError();

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      if (!data.user) {
        throw new Error("Failed to sign in");
      }

      logger.info("✅ Login successful", {
        userId: data.user.id,
        email: data.user.email,
      });

      setUser(data.user);
      await fetchProfile(data.user.id);
    } catch (err) {
      logger.error("Login failed", { email }, err as Error);
      const appError = ErrorHandler.handleSupabaseError(err, "signIn");
      setError(appError);
      throw new AppErrorException(appError);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sign out user
   */
  const signOut = async () => {
    logger.info("🚪 Logging out user");

    if (!supabase) {
      const err = ErrorHandler.logError(
        "SUPABASE_NOT_INITIALIZED",
        "Supabase not initialized",
        {}
      );
      setError(err);
      throw new AppErrorException(err);
    }

    setIsLoading(true);
    clearError();

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      logger.info("✅ Logout successful");
      setUser(null);
      setProfile(null);
    } catch (err) {
      logger.error("Logout failed", {}, err as Error);
      const appError = ErrorHandler.handleSupabaseError(err, "signOut");
      setError(appError);
      throw new AppErrorException(appError);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !supabase) {
      const err = ErrorHandler.logError(
        "AUTH_NOT_AUTHENTICATED",
        "User not authenticated",
        {}
      );
      setError(err);
      throw new AppErrorException(err);
    }

    logger.info("Updating user profile", { userId: user.id, updates });

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info("✅ Profile updated successfully", { userId: user.id });
      setProfile(data);
    } catch (err) {
      logger.error("Failed to update profile", { userId: user.id }, err as Error);
      const appError = ErrorHandler.handleSupabaseError(
        err,
        "updateProfile"
      );
      setError(appError);
      throw new AppErrorException(appError);
    }
  };

  /**
   * Clear error state
   */
  const clearError = () => {
    setError(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    error,
    signUp,
    signIn,
    signOut,
    updateProfile,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
