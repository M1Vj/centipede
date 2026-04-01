"use client";

import type { Session, User } from "@supabase/supabase-js";
import {
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
  signOut: () => void;
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
  const [isLoading, setIsLoading] = useState(!initialUser);

  async function syncProfile(nextUser: User | null) {
    console.log("[AuthProvider] syncProfile starting for user:", nextUser?.id);
    if (!nextUser || !hasEnvVars) {
      console.log("[AuthProvider] No user or env, clearing profile.");
      setProfile(null);
      return null;
    }

    try {
      console.log("[AuthProvider] Fetching profile from DB...");
      const nextProfile = await fetchProfile(nextUser.id);
      console.log("[AuthProvider] Profile fetched:", nextProfile);
      setProfile(nextProfile);
      return nextProfile;
    } catch (error) {
      console.error("[AuthProvider] Profile fetch error:", error);
      throw error;
    }
  }

  async function refreshProfile() {
    console.log("[AuthProvider] refreshProfile triggered.");
    return syncProfile(user);
  }

  function signOut() {
    if (!hasEnvVars) {
      feedbackRouter.push("/auth/login");
      return;
    }

    isSigningOutRef.current = true;

    setSession(null);
    setUser(null);
    setProfile(null);

    // Navigate to the sign-out page which handles server-side session clearing
    // and shows a loading UI. Avoid calling supabase.auth.signOut() here to
    // prevent lock contention with the server action.
    window.location.replace("/auth/sign-out");
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
        data: { user: nextUser },
      } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      setUser(nextUser);
      // We don't have the full session here from getUser, but we can fetch it if needed
      // However, for profile sync, just the user is enough.
      const { data: { session: nextSession } } = await supabase.auth.getSession();
      setSession(nextSession);

      await syncProfile(nextUser);

      if (isMounted) {
        setIsLoading(false);
      }
    }

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (isSigningOutRef.current) return;

      const { data: { user: verifiedUser } } = await supabase.auth.getUser();
      const nextUser = verifiedUser ?? nextSession?.user ?? null;

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
        setSession(nextSession);
        setUser(nextUser);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router, initialUser, initialProfile, user?.id]);

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
