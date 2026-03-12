import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ProfileCompletionForm } from "@/components/profile-completion-form";
import { Card, CardContent } from "@/components/ui/card";
import {
  isProfileComplete,
  PROFILE_SELECT_FIELDS,
  type AuthProfile,
} from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/supabase/env";

async function getProfileCompletionContext() {
  if (!hasEnvVars) {
    return {
      userId: "",
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", user.id)
    .maybeSingle<AuthProfile>();

  if (error) {
    throw error;
  }

  if (isProfileComplete(profile)) {
    redirect("/");
  }

  return {
    userId: user.id,
    profile,
  };
}

async function ProfileCompletionContent() {
  const { userId, profile } = await getProfileCompletionContext();

  return (
    <AuthShell
      eyebrow="Profile"
      title="Finish your Mathwiz Arena setup"
      description="A complete profile unlocks protected routes and gives the platform the context it needs for registrations, team management, and future role-based experiences."
    >
      <div className="w-full max-w-md">
        <ProfileCompletionForm userId={userId} profile={profile} />
      </div>
    </AuthShell>
  );
}

function ProfileCompletionFallback() {
  return (
    <AuthShell
      eyebrow="Profile"
      title="Finish your Mathwiz Arena setup"
      description="A complete profile unlocks protected routes and gives the platform the context it needs for registrations, team management, and future role-based experiences."
    >
      <div className="w-full max-w-md">
        <Card className="border-border/70 bg-background/90 shadow-lg">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-40 rounded-full bg-muted" />
            <div className="h-11 rounded-xl bg-muted" />
            <div className="h-11 rounded-xl bg-muted" />
            <div className="h-11 rounded-xl bg-muted" />
            <div className="h-10 rounded-xl bg-muted" />
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}

export default function ProfileCompletionPage() {
  return (
    <Suspense fallback={<ProfileCompletionFallback />}>
      <ProfileCompletionContent />
    </Suspense>
  );
}
