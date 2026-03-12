"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { isProfileComplete, type ProfileCompletionFields } from "@/lib/auth/profile";
import { hasEnvVars } from "@/lib/supabase/env";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type AuthProfile = ProfileCompletionFields & {
  id: string;
  email: string;
  role: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  hasCompletedProfile: boolean;
  refreshProfile: () => Promise<AuthProfile | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, school, grade_level, role")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function syncProfile(nextUser: User | null) {
    if (!nextUser || !hasEnvVars) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchProfile(nextUser.id);
    setProfile(nextProfile);
    return nextProfile;
  }

  async function refreshProfile() {
    return syncProfile(user);
  }

  async function signOut() {
    if (!hasEnvVars) {
      router.push("/auth/login");
      return;
    }

    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    router.push("/auth/login");
    router.refresh();
  }

  useEffect(() => {
    if (!hasEnvVars) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let isMounted = true;

    async function bootstrap() {
      setIsLoading(true);
      const {
        data: { session: nextSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      await syncProfile(nextSession?.user ?? null);

      if (isMounted) {
        setIsLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(true);

      void syncProfile(nextSession?.user ?? null).finally(() => {
        if (isMounted) {
          setIsLoading(false);
          router.refresh();
        }
      });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        isLoading,
        hasCompletedProfile: isProfileComplete(profile),
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
