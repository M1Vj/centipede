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
import { ShieldCheck, Trophy, Users2 } from "lucide-react";

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

const protectedCards = [
  {
    icon: ShieldCheck,
    title: "Route protection",
    description:
      "The proxy and SSR client are already ready to guard dashboards once the full authentication branch lands.",
  },
  {
    icon: Users2,
    title: "Role-aware expansion",
    description:
      "This area will split into mathlete, organizer, and admin experiences instead of a single starter page.",
  },
  {
    icon: Trophy,
    title: "Competition dashboard",
    description:
      "Upcoming branches will turn this placeholder into registration, monitoring, and arena entry points.",
  },
];

async function ProtectedPageContent() {
  const { userEmail, profile } = await getWorkspaceContext();

  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card className="surface-card overflow-hidden border-border/60">
          <CardHeader>
            <div className="eyebrow">Protected Workspace</div>
            <CardTitle className="mt-6 text-4xl">
              The private dashboard is now a clean placeholder.
            </CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              The starter tutorial content has been removed so future branches
              can build the real participant and organizer dashboards without
              carrying template copy forward.
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
                  ? "Your profile is complete, so the protected workspace is now available for the next branches."
                  : "Once .env.local is populated, sign in and this space can be used to validate the protected routing flow."}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          {protectedCards.map(({ icon: Icon, title, description }) => (
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

function ProtectedPageFallback() {
  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <Card className="surface-card overflow-hidden border-border/60">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-40 rounded-full bg-muted" />
            <div className="h-12 w-4/5 rounded-2xl bg-muted" />
            <div className="h-24 rounded-[1.5rem] bg-muted" />
          </CardContent>
        </Card>
        <div className="grid gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="border-border/60 bg-background/70 shadow-sm">
              <CardContent className="p-5">
                <div className="h-20 rounded-2xl bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function ProtectedPage() {
  return (
    <Suspense fallback={<ProtectedPageFallback />}>
      <ProtectedPageContent />
    </Suspense>
  );
}
