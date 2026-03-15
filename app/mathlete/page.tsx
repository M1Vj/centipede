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
import { Trophy, Users2, Brain } from "lucide-react";

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

  return {
    userEmail: user.email ?? "signed-in user",
    profile,
  };
}

const mathleteCards = [
  {
    icon: Brain,
    title: "Competition Arena",
    description:
      "Access live contests, training rounds, and problem archives from your personal arena.",
  },
  {
    icon: Trophy,
    title: "My Achievements",
    description:
      "Track your rankings, solved problems, and contest history as you climb the leaderboard.",
  },
  {
    icon: Users2,
    title: "Community & Teams",
    description:
      "Collaborate with your school team and see how you compare to other mathletes globally.",
  },
];

async function MathletePageContent() {
  const { userEmail, profile } = await getWorkspaceContext();

  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card className="surface-card overflow-hidden border-border/60">
          <CardHeader>
            <div className="eyebrow">Mathlete Workspace</div>
            <CardTitle className="mt-6 text-4xl">
              Mathlete Dashboard
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              Welcome to your dedicated dashboard. This space will eventually house your active competitions,
              practice history, and performance metrics.
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
                  ? "Your profile is complete, and your mathlete dashboard is now ready for the upcoming contest features."
                  : "Once .env.local is populated, sign in to access your personal mathlete space."}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {mathleteCards.map(({ icon: Icon, title, description }) => (
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

function MathletePageFallback() {
  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <DetailSectionSkeleton lines={3} />
        <CardSkeletonList count={3} />
      </div>
    </section>
  );
}

export default function MathletePage() {
  return (
    <Suspense fallback={<MathletePageFallback />}>
      <MathletePageContent />
    </Suspense>
  );
}
