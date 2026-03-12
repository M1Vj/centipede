import { redirect } from "next/navigation";

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

async function getUserEmail() {
  if (!hasEnvVars) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  return data.claims.email ?? "signed-in user";
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

export default async function ProtectedPage() {
  const userEmail = await getUserEmail();

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
                  ? `Authenticated as ${userEmail}.`
                  : "Supabase environment variables are not configured locally yet."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {userEmail
                  ? "This route remains protected and ready for role-based experiences."
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
