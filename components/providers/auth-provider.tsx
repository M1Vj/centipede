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
import { usePathname, useRouter } from "next/navigation";
import {
  claimAccountInstance,
  isAccountOpenInAnotherInstance,
  releaseAccountInstance,
} from "@/lib/auth/account-instance";

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
  const pathname = usePathname();
  const feedbackRouter = useFeedbackRouter();
  const isSigningOutRef = useRef(false);
  const signingOutUserIdRef = useRef<string | null>(null);
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
    signingOutUserIdRef.current = user?.id ?? null;

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
      if (signingOutUserIdRef.current) {
        releaseAccountInstance(signingOutUserIdRef.current);
        signingOutUserIdRef.current = null;
      }

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

  useEffect(() => {
    if (!hasEnvVars || !user || pathname === "/auth/login") {
      return;
    }

    let isStopped = false;

    const verifyCurrentSession = async () => {
      try {
        const response = await fetch("/auth/session", {
          method: "GET",
          cache: "no-store",
        });

        if (!isStopped && response.status === 409) {
          const payload = (await response.json().catch(() => null)) as {
            redirectTo?: string;
          } | null;
          feedbackRouter.push(payload?.redirectTo ?? "/auth/session-replaced");
        }
      } catch {
        // Transient network failures should not sign users out.
      }
    };

    const handleFocus = () => {
      void verifyCurrentSession();
    };

    void verifyCurrentSession();
    window.addEventListener("focus", handleFocus);
    const intervalId = window.setInterval(verifyCurrentSession, 30_000);

    return () => {
      isStopped = true;
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(intervalId);
    };
  }, [feedbackRouter, pathname, user]);

  useEffect(() => {
    if (!hasEnvVars || !user || pathname === "/auth/login") {
      return;
    }

    let isStopped = false;

    const syncAccountInstance = () => {
      if (isStopped || isSigningOutRef.current) {
        return;
      }

      if (isAccountOpenInAnotherInstance(user.id)) {
        feedbackRouter.push("/auth/session-replaced?next=%2Fauth%2Flogin&reason=session_replaced");
        return;
      }

      claimAccountInstance(user.id);
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea === window.localStorage) {
        syncAccountInstance();
      }
    };

    const handleFocus = () => {
      syncAccountInstance();
    };

    const handleBeforeUnload = () => {
      releaseAccountInstance(user.id);
    };

    syncAccountInstance();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("beforeunload", handleBeforeUnload);
    const intervalId = window.setInterval(syncAccountInstance, 5_000);

    return () => {
      isStopped = true;
      releaseAccountInstance(user.id);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.clearInterval(intervalId);
    };
  }, [feedbackRouter, pathname, user]);

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
