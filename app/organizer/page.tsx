import { Suspense } from "react";
import { redirect } from "next/navigation";

import {
  isProfileComplete,
  PROFILE_SELECT_FIELDS,
  type AuthProfile,
} from "@/lib/auth/profile";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/supabase/env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CardSkeletonList,
  DetailSectionSkeleton,
} from "@/components/ui/feedback-skeletons";
import { Building, ClipboardList, Users } from "lucide-react";

async function getWorkspaceContext() {
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_FIELDS)
    .eq("id", user.id)
    .maybeSingle<AuthProfile>();

  if (error) {
    throw error;
  }

  if (!isProfileComplete(profile)) {
    redirect("/profile/complete");
  }

  if (profile?.is_active === false) {
    redirect("/auth/suspended");
  }

  if (profile?.role !== "organizer") {
    if (profile?.role === "admin") {
      redirect("/admin");
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

const organizerCards = [
  {
    icon: Building,
    title: "School Management",
    description:
      "Manage your school's registration, teams, and eligibility for upcoming competitions.",
  },
  {
    icon: ClipboardList,
    title: "Competition Hosting",
    description:
      "Organize local rounds, monitor live scoring, and submit results for validation.",
  },
  {
    icon: Users,
    title: "Participant Roster",
    description:
      "View and manage the mathletes under your organization's supervision.",
  },
];

async function OrganizerPageContent() {
  const { userEmail, profile } = await getWorkspaceContext();

  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card className="surface-card overflow-hidden border-border/60">
          <CardHeader>
            <div className="eyebrow">Organizer Workspace</div>
            <CardTitle className="mt-6 text-4xl">
              Organizer Dashboard
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              Welcome to the Organizer Dashboard. Use this space to coordinate with schools,
              manage large-scale competitions, and oversee mathematical excellence in your region.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5">
              <p className="text-sm font-semibold text-foreground">
                {userEmail
                  ? `Authenticated as ${profile?.full_name || userEmail}.`
                  : "Supabase environment variables are not configured locally yet."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {userEmail
                  ? "Your profile is complete, and your organizer tools will be populated as new features are released."
                  : "Once .env.local is populated, sign in to access your organization's dashboard."}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {organizerCards.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="border-border/60 bg-background/70 shadow-sm">
              <CardContent className="flex gap-4 p-5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function OrganizerPageFallback() {
  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <DetailSectionSkeleton lines={3} />
        <CardSkeletonList count={3} />
      </div>
    </section>
  );
}

export default function OrganizerPage() {
  return (
    <Suspense fallback={<OrganizerPageFallback />}>
      <OrganizerPageContent />
    </Suspense>
  );
}
