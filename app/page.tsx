import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { hasEnvVars } from "@/lib/supabase/env";
import {
  ArrowRight,
  CalendarCheck2,
  MonitorSmartphone,
  ShieldCheck,
  Trophy,
  Users2,
} from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

const platformHighlights = [
  {
    icon: ShieldCheck,
    title: "Secure auth foundation",
    description:
      "Supabase SSR helpers, proxy refresh handling, and route-ready structure are in place for the next branch.",
  },
  {
    icon: Users2,
    title: "Role-based product shape",
    description:
      "The shell is already aligned with mathletes, coaches, and organizers instead of generic starter copy.",
  },
  {
    icon: Trophy,
    title: "Competition-first design",
    description:
      "Global tokens, cards, and layout patterns are tuned for dashboards, leaderboards, and live event flows.",
  },
];

const milestones = [
  {
    branch: "02",
    title: "Authentication",
    description: "Google OAuth, email login, profile completion, and protected entry flows.",
  },
  {
    branch: "03",
    title: "Admin tools",
    description: "User moderation, organizer approval, and guardrails around privileged actions.",
  },
  {
    branch: "04",
    title: "Organizer onboarding",
    description: "Application workflow, eligibility review, and the first real role-specific feature set.",
  },
];

export default function Home() {
  return (
    <div className="pb-20">
      <section className="shell py-16 sm:py-24">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-center">
          <div className="space-y-8 content-fade">
            <span className="eyebrow">Foundation Branch</span>

            <div className="space-y-5">
              <h1 className="section-heading text-5xl sm:text-6xl">
                Math contests without the spreadsheet chaos.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                Mathwiz Arena gives schools and organizers a single control room
                for registration, live rounds, and post-competition review.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="shadow-[0_18px_40px_-20px_hsl(var(--primary)/0.85)]"
              >
                <ProgressLink href="/auth/sign-up">
                  Register now
                  <ArrowRight className="size-4" />
                </ProgressLink>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-background/70">
                <ProgressLink href="/auth/login">Open login</ProgressLink>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <ProgressLink href="/organizer/apply">Apply as organizer</ProgressLink>
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 shadow-sm">
                <MonitorSmartphone className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">Responsive shell</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A mobile-first layout that scales toward admin and organizer workspaces.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 shadow-sm">
                <CalendarCheck2 className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">Competition-ready</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Design tokens and card patterns already fit scheduling, arena, and results views.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 shadow-sm">
                <ShieldCheck className="size-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">Supabase SSR</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Authentication plumbing stays compatible with current publishable keys and older anon keys.
                </p>
              </div>
            </div>
          </div>

          <div className="content-fade lg:justify-self-end">
            <div className="surface-card hero-grid relative overflow-hidden p-6 sm:p-8">
              <div className="absolute -right-16 top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl float-slow" />
              <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-accent/70 blur-3xl" />

              <div className="relative space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                      Build status
                    </p>
                    <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                      Ready for the auth branch.
                    </h2>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      hasEnvVars
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                    }
                  >
                    {hasEnvVars ? "Supabase configured" : "Environment pending"}
                  </Badge>
                </div>

                <div className="rounded-[1.75rem] border border-border/70 bg-background/80 p-5 shadow-sm">
                  <p className="text-sm font-medium text-foreground">
                    Foundation deliverables
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                      <p className="text-sm font-semibold">Global layout</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Shared navigation, theme switching, and consistent spacing.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                      <p className="text-sm font-semibold">Design tokens</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Neutral surfaces with blue accents, motion, and reusable surface styles.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                      <p className="text-sm font-semibold">Auth-ready routing</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Existing Supabase helpers stay intact while visible starter noise is removed.
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-card p-4">
                      <p className="text-sm font-semibold">Future-safe setup</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Environment handling now works with both publishable and anon-key guides.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-primary/15 bg-primary/5 p-5">
                  <p className="text-sm leading-6 text-muted-foreground">
                    {hasEnvVars
                      ? "Supabase credentials are already available, so the next branch can focus on authentication UX and profile enforcement instead of setup churn."
                      : "Add .env.local with NEXT_PUBLIC_SUPABASE_URL and either NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY before testing login and registration flows."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell py-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {platformHighlights.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="surface-card h-full border-border/60">
              <CardHeader>
                <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <CardTitle className="mt-4 text-2xl">{title}</CardTitle>
                <CardDescription className="text-base leading-7">
                  {description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section className="shell py-12">
        <div className="surface-card p-8 md:p-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <div className="space-y-4">
              <span className="eyebrow">Next Up</span>
              <h2 className="section-heading text-4xl">
                A foundation that leaves the next branches room to move.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                The starter template has been stripped back to a product shell,
                so upcoming work can focus on real workflows: authentication,
                role-aware dashboards, and organizer tooling.
              </p>
            </div>

            <div className="grid gap-4">
              {milestones.map(({ branch, title, description }) => (
                <Card key={branch} className="border-border/60 bg-background/70 shadow-sm">
                  <CardContent className="flex gap-4 p-5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      {branch}
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
        </div>
      </section>
    </div>
  );
}
