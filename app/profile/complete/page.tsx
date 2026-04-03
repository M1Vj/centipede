import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ProfileCompletionForm } from "@/components/profile-completion-form";
import { FormSkeleton } from "@/components/ui/feedback-skeletons";
import { isProfileComplete } from "@/lib/auth/profile";
import { getWorkspaceContext } from "@/lib/auth/workspace";

async function getProfileCompletionContext() {
  const { profile, userEmail } = await getWorkspaceContext({
    requireCompleteProfile: false,
  });

  if (isProfileComplete(profile)) {
    if (profile?.role === "admin") {
      redirect("/admin");
    }

    if (profile?.role === "organizer") {
      redirect("/organizer");
    }

    redirect("/mathlete");
  }

  return {
    userId: profile?.id ?? "",
    userEmail: userEmail ?? "",
    profile: profile ?? null,
  };
}

async function ProfileCompletionContent() {
  const context = await getProfileCompletionContext();

  return (
    <AuthShell
      eyebrow="Profile"
      title="Finish your Mathwiz Arena setup"
      description="A complete profile unlocks protected routes and gives the platform the context it needs for registrations, team management, and future role-based experiences."
    >
      <div className="w-full max-w-md">
        <ProfileCompletionForm userId={context.userId} userEmail={context.userEmail} profile={context.profile} />
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
        <FormSkeleton fields={3} />
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
