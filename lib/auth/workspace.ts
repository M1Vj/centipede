"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isProfileComplete, PROFILE_SELECT_FIELDS, type AuthProfile } from "@/lib/auth/profile";
import {
  getSessionSignOutHref,
  getSessionVersionCookieValue,
  isSessionStale,
  isSessionVersionSchemaError,
} from "@/lib/auth/session";
import { hasEnvVars } from "@/lib/supabase/env";

const PROFILE_WITH_SESSION_FIELDS = `${PROFILE_SELECT_FIELDS}, session_version`;

export type WorkspaceContext = {
  userEmail: string | null;
  profile: (AuthProfile & { session_version?: number | null }) | null;
};

async function fetchWorkspaceProfile(userId: string) {
  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_WITH_SESSION_FIELDS)
    .eq("id", userId)
    .maybeSingle<AuthProfile & { session_version?: number | null }>();

  if (error && !isSessionVersionSchemaError(error)) {
    throw error;
  }

  if (error) {
    const { data: fallbackProfile, error: fallbackError } = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_FIELDS)
      .eq("id", userId)
      .maybeSingle<AuthProfile>();

    if (fallbackError) {
      throw fallbackError;
    }

    return (fallbackProfile as (AuthProfile & { session_version?: number | null }) | null) ?? null;
  }

  return profile ?? null;
}

export async function getWorkspaceContext({
  requireRole,
  requireCompleteProfile = true,
}: {
  requireRole?: "mathlete" | "organizer" | "admin";
  requireCompleteProfile?: boolean;
} = {}): Promise<WorkspaceContext> {
  if (!hasEnvVars) {
    return {
      userEmail: null,
      profile: null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const profile = await fetchWorkspaceProfile(user.id);
  const sessionVersion = getSessionVersionCookieValue(await cookies());

  if (profile?.is_active === false) {
    redirect("/auth/suspended");
  }

  if (isSessionStale(profile, { sessionVersion })) {
    redirect(getSessionSignOutHref("/auth/login"));
  }

  if (requireCompleteProfile && !isProfileComplete(profile)) {
    redirect("/profile/complete");
  }

  if (requireRole && profile?.role !== requireRole) {
    if (profile?.role === "admin") {
      redirect("/admin");
    }

    if (profile?.role === "organizer") {
      redirect("/organizer");
    }

    if (profile?.role === "mathlete") {
      redirect("/mathlete");
    }

    redirect("/");
  }

  return {
    userEmail: user.email ?? "signed-in user",
    profile,
  };
}
