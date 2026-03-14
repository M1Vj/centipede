import type { ReactNode } from "react";
import { ShieldCheck, Sparkles, Trophy } from "lucide-react";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

const pillars = [
  {
    icon: ShieldCheck,
    title: "Secure sessions",
    description:
      "Supabase SSR keeps authentication aligned between browser and server routes.",
  },
  {
    icon: Trophy,
    title: "Competition-ready",
    description:
      "The same foundation carries forward into protected rounds, reviews, and leaderboards.",
  },
  {
    icon: Sparkles,
    title: "Responsive shell",
    description:
      "Every auth surface inherits the same mobile-first layout and theme-aware styling.",
  },
];

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <section className="shell py-14 md:py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-start">
        <div className="surface-card hero-grid relative overflow-hidden p-8 md:p-10 content-fade">
          <div className="absolute -right-16 top-12 h-36 w-36 rounded-full bg-primary/15 blur-3xl float-slow" />
          <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-accent/70 blur-3xl" />

          <div className="relative space-y-6">
            <span className="eyebrow">{eyebrow}</span>
            <div className="space-y-4">
              <h1 className="section-heading max-w-xl text-4xl sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                {description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {pillars.map(({ icon: Icon, title: pillarTitle, description: copy }) => (
                <div
                  key={pillarTitle}
                  className="rounded-[1.5rem] border border-border/70 bg-background/80 p-4 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h2 className="mt-4 text-sm font-semibold text-foreground">
                    {pillarTitle}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {copy}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="w-full max-w-md content-fade lg:justify-self-end">
          {children}
        </div>
      </div>
    </section>
  );
}
