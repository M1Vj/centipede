"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  isProfileComplete,
  PROFILE_SELECT_FIELDS,
  type AuthProfile,
} from "@/lib/auth/profile";
import { hasEnvVars } from "@/lib/supabase/env";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { useRouter } from "next/navigation";

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
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export function AuthProvider({ 
  children,
  initialUser = null,
  initialSession = null,
  initialProfile = null,
}: { 
  children: ReactNode;
  initialUser?: User | null;
  initialSession?: Session | null;
  initialProfile?: AuthProfile | null;
}) {
  const router = useRouter();
  const feedbackRouter = useFeedbackRouter();
  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [isLoading, setIsLoading] = useState(!initialUser);

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
      feedbackRouter.push("/auth/login");
      return;
    }

    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
    feedbackRouter.push("/auth/login");
  }

  useEffect(() => {
    if (!hasEnvVars) {
      setIsLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    let isMounted = true;

    async function bootstrap() {
      // If we already have initial state, we can skip the initial bootstrap fetch
      if (initialUser && initialProfile) {
        setIsLoading(false);
        return;
      }

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
      const nextUser = nextSession?.user ?? null;
      
      // Prevent flickering: Only set loading if the user has actually changed
      // or if we're in a completely fresh state.
      if (nextUser?.id !== user?.id) {
        setSession(nextSession);
        setUser(nextUser);
        setIsLoading(true);

        void syncProfile(nextUser).finally(() => {
          if (isMounted) {
            setIsLoading(false);
            router.refresh();
          }
        });
      } else {
        // Just sync session/user if they are the same (e.g. token refresh)
        setSession(nextSession);
        setUser(nextUser);
      }
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
