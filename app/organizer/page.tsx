import { Suspense } from "react";
import { getWorkspaceContext as getProtectedWorkspaceContext } from "@/lib/auth/workspace";
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
import {
  ChartColumnIncreasing,
  ClipboardList,
  Library,
  Settings,
} from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";

async function getWorkspaceContext() {
  return getProtectedWorkspaceContext({ requireRole: "organizer" });
}

const organizerCards = [
  {
    icon: ClipboardList,
    title: "Profile completion",
    description: "Finalize organizer profile details before building problem banks.",
    href: "/organizer/profile",
  },
  {
    icon: Settings,
    title: "Workspace settings",
    description: "Maintain contact settings while keeping your login identifier immutable.",
    href: "/organizer/settings",
  },
  {
    icon: Library,
    title: "Problem banks",
    description: "Create and maintain reusable banks with math authoring, imports, and problem-level workflows.",
    href: "/organizer/problem-bank",
  },
];

const organizerStatShell = [
  {
    label: "Competitions hosted",
    value: "0",
    hint: "Data insights will populate after branch 08.",
  },
  {
    label: "Active teams",
    value: "0",
    hint: "Team metrics begin in branch 09.",
  },
  {
    label: "Problem banks",
    value: "0",
    hint: "Authoring modules are now active in branch 06.",
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
            <CardTitle className="mt-6 text-4xl">Organizer Dashboard</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              Your organizer access is active. This dashboard now includes a first-run summary,
              onboarding links, and statistics/data-insights shells for upcoming branches.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-[1.5rem] border border-primary/15 bg-primary/5 p-5">
              <p className="text-sm font-semibold text-foreground">
                {userEmail
                  ? `Authenticated as ${profile?.full_name || userEmail}.`
                  : "Supabase environment variables are not configured locally yet."}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {userEmail
                  ? "Organizer routing is active. Finish profile and workspace settings now so later organizer tools can use complete identity data."
                  : "Once .env.local is populated, sign in to access your organization's dashboard."}
              </p>
            </div>

            <div className="grid gap-4 rounded-[1.5rem] border border-border/60 bg-background/80 p-5 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Profile summary
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">
                  Full name: {profile?.full_name || "Incomplete"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Organization: {profile?.organization || "Incomplete"}
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <ProgressLink href="/organizer/profile" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                  Open organizer profile
                </ProgressLink>
                <ProgressLink href="/organizer/settings" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
                  Open organizer settings
                </ProgressLink>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="border-border/60 bg-background/70 shadow-sm">
            <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
              {organizerStatShell.map(({ label, value, hint }) => (
                <div key={label} className="rounded-xl border border-border/60 bg-background/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-foreground">{value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {organizerCards.map(({ icon: Icon, title, description, href }) => (
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
                  <ProgressLink href={href} className="mt-2 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">
                    Open section
                  </ProgressLink>
                </div>
              </CardContent>
            </Card>
          ))}

          <Card className="border-border/60 bg-background/70 shadow-sm">
            <CardContent className="flex gap-4 p-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ChartColumnIncreasing className="size-5" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">Data insights shell</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Analytics cards, activity trends, and organizer performance insights are intentionally scaffolded now and expand in later organizer branches.
                </p>
              </div>
            </CardContent>
          </Card>
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
