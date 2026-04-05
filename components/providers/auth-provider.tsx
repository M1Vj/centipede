"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useRef,
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
  const isSigningOutRef = useRef(false);
  const [session, setSession] = useState<Session | null>(initialSession);
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<AuthProfile | null>(initialProfile);
  const [isLoading, setIsLoading] = useState(false);
  const currentUserIdRef = useRef<string | undefined>(initialUser?.id);

  const syncProfile = useCallback(async (nextUser: User | null) => {
    if (!nextUser || !hasEnvVars) {
      setProfile(null);
      return null;
    }

    const nextProfile = await fetchProfile(nextUser.id);
    setProfile(nextProfile);
    return nextProfile;
  }, []);

  async function refreshProfile() {
    return syncProfile(user);
  }

  async function signOut() {
    if (!hasEnvVars) {
      feedbackRouter.push("/auth/login");
      return;
    }

    isSigningOutRef.current = true;

    // Optimistically update the UI to avoid the late-reload header issue
    setSession(null);
    setUser(null);
    setProfile(null);

    try {
      // Call the backend signout route to ensure HTTP-only cookies and server session are properly cleared
      await fetch("/auth/sign-out", {
        method: "POST",
      });
    } catch {
    } finally {
      // Smooth client-side transition instead of hard full page reload
      router.refresh();
      feedbackRouter.push("/");

      // Hold the signOut promise (and thus the loading modal) open briefly 
      // to let the Next.js client-side router finish navigating to `/`. 
      // This prevents the user from seeing the current page briefly re-rendering
      // in an unauthenticated state before the transition completes.
      await new Promise((resolve) => setTimeout(resolve, 800));
      isSigningOutRef.current = false;
    }
  }

  useEffect(() => {
    if (!hasEnvVars) {
      return;
    }

    const supabase = getSupabaseClient();
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (isSigningOutRef.current) return;

      const nextUser = nextSession?.user ?? null;

      if (nextUser?.id !== currentUserIdRef.current) {
        currentUserIdRef.current = nextUser?.id;
        setSession(nextSession);
        setUser(nextUser);
        setIsLoading(true);

        void syncProfile(nextUser).finally(() => {
          if (isMounted) {
            setIsLoading(false);
          }
        });
      } else {
        setSession(nextSession);
        setUser(nextUser);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [syncProfile]);

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
