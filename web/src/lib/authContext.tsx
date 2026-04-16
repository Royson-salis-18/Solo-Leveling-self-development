import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
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
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // No Supabase → immediately done loading (preview mode)
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    // Check current session on mount
    const checkAuth = async () => {
      const { data } = await supabase!.auth.getSession();
      if (data.session?.user) {
        setUser(data.session.user);
        localStorage.setItem("user_email", data.session.user.email ?? "");
        await fetchProfile(data.session.user.id);
      }
      setIsLoading(false);
    };

    checkAuth();

    // Listen for auth state changes
    const { data: listener } = supabase!.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          localStorage.setItem("user_email", session.user.email ?? "");
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          localStorage.removeItem("user_email");
        }
        setIsLoading(false);
      }
    );

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    if (!supabase) return;

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    if (!supabase) throw new Error("Supabase not configured");

    setIsLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create profile row
      const { error: profileError } = await supabase
        .from("user_profiles")
        .insert({ user_id: authData.user.id, email, name, level: 1, total_points: 0 });
      if (profileError) throw profileError;

      localStorage.setItem("user_email", email);
      setUser(authData.user);
      await fetchProfile(authData.user.id);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error("Supabase not configured");

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user) throw new Error("Failed to sign in");

      localStorage.setItem("user_email", email);
      setUser(data.user);
      await fetchProfile(data.user.id);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) throw new Error("Supabase not configured");

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
      localStorage.removeItem("user_email");
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user || !supabase) throw new Error("Not authenticated");

    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .update(updates)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user || !supabase,
        signUp,
        signIn,
        signOut,
        updateProfile,
      }}
    >
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
