import { Check, Circle, Play, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";
import { hasEnvVars } from "@/lib/supabase/env";

const featureCards = [
  {
    title: "Competition Control Center",
    description:
      "Centralized dashboard for teachers to manage live heats, time limits, and question banks.",
  },
  {
    title: "Live Leaderboard Engine",
    description:
      "Instant ranking updates with millisecond precision tracking for high-stakes speed drills.",
  },
  {
    title: "Smart Competition Scheduler",
    description:
      "Automate seasonal leagues and qualifying rounds with intelligent student-matching logic.",
  },
];

const methodologySteps = [
  {
    phase: "Phase 01",
    title: "Build the Foundation",
    description:
      "Create targeted problem tracks and school-specific pathways for every cohort.",
    tone: "amber" as const,
  },
  {
    phase: "Phase 02",
    title: "Enter The Arena",
    description:
      "Run timed rounds in secure, high-focus competition spaces with synchronized state.",
    tone: "navy" as const,
  },
  {
    phase: "Phase 03",
    title: "Track Excellence",
    description:
      "Analyze results and trend lines to drive measurable school-wide improvement.",
    tone: "ink" as const,
  },
];

const leaderboardRows = [
  { name: "Jasmine Rivera", score: "2,450", accent: "w-[86%]" },
  { name: "Alex Chen", score: "2,380", accent: "w-[74%]" },
  { name: "Marco Wilson", score: "2,210", accent: "w-[68%]" },
];

const pricingTiers = [
  {
    name: "Starter",
    price: "$49",
    suffix: "/mo",
    cta: "Select Plan",
    featured: false,
    features: ["Up to 100 students", "5 competition tracks", "Basic leaderboards"],
  },
  {
    name: "Accelerator",
    price: "$149",
    suffix: "/mo",
    cta: "Start Free Trial",
    featured: true,
    features: [
      "Up to 500 students",
      "Unlimited tracks",
      "Advanced analytics",
      "Priority support",
    ],
  },
  {
    name: "Elite",
    price: "$399",
    suffix: "/mo",
    cta: "Contact Sales",
    featured: false,
    features: [
      "Unlimited everything",
      "Custom integrations",
      "Multi-campus support",
      "Account manager",
    ],
  },
];

export function LandingPage() {
  return (
    <div className="bg-[#f8f6f6] pb-24 text-[#0f172a]">
      <section id="product" className="shell scroll-mt-32 pt-28 sm:pt-36 lg:pt-40">
        <div className="mx-auto flex max-w-[1000px] flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#f49700]/20 bg-[#f49700]/10 px-4 py-1.5 text-[0.7rem] font-bold uppercase tracking-[0.24em] text-[#f49700]">
            <Circle className="size-2.5 fill-current" />
            Live Competition Now Open
          </span>

          <h1 className="mt-7 max-w-[860px] font-sans text-[2.95rem] font-extrabold leading-[0.95] tracking-[-0.065em] text-[#0f172a] sm:text-[4.2rem] lg:text-[4.85rem]">
            Mathematical
            <br />
            excellence, <span className="text-[#f49700]">scaled for</span>
            <br />
            <span className="text-[#f49700]">schools.</span>
          </h1>

          <p className="mt-6 max-w-[700px] text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
            The all-in-one platform for modern school administrators to manage competitions,
            track excellence, and engage students.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button
              asChild
              className="h-14 rounded-2xl bg-[#f49700] px-10 text-base font-bold text-white shadow-[0_20px_36px_-24px_rgba(244,151,0,0.95)] hover:bg-[#e79000]"
            >
              <ProgressLink href="/auth/sign-up">Start Free Trial</ProgressLink>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-14 rounded-2xl border-slate-200 bg-white px-10 text-base font-bold text-[#0f172a] shadow-[0_1px_2px_rgba(15,23,42,0.06)] hover:bg-slate-50"
            >
              <ProgressLink href="#features">
                <Play className="size-4 fill-current" />
                View Demo
              </ProgressLink>
            </Button>
          </div>

          <DashboardPreview />
        </div>
      </section>

      <section id="features" className="scroll-mt-32 py-24 sm:py-28">
        <div className="shell">
          <div className="mx-auto max-w-[700px] text-center">
            <h2 className="font-sans text-[2rem] font-extrabold tracking-[-0.05em] text-[#0d1b2a] sm:text-[2.3rem]">
              Every tool your school needs
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-500">
              Seamlessly integrate competition-grade analytics into your curriculum.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {featureCards.map((feature, index) => (
              <article
                key={feature.title}
                className="rounded-[14px] border border-black/5 bg-[#f8f6f6] p-8 shadow-[0_4px_28px_-22px_rgba(15,23,42,0.35)]"
              >
                <div className="mb-8 h-48 overflow-hidden rounded-[10px] bg-white/70 p-6">
                  {index === 0 ? <FeatureStackIcon /> : null}
                  {index === 1 ? <FeatureLeaderboardIcon /> : null}
                  {index === 2 ? <FeatureSchedulerIcon /> : null}
                </div>
                <h3 className="font-sans text-xl font-extrabold tracking-[-0.04em] text-[#0d1b2a]">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-slate-500">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="methodology" className="shell scroll-mt-32 py-8 sm:py-14">
        <div className="mx-auto max-w-[520px] text-center">
          <h2 className="font-sans text-[1.95rem] font-extrabold tracking-[-0.05em] text-[#0d1b2a] sm:text-[2.2rem]">
            The Methodology
          </h2>
          <p className="mt-2 text-sm text-slate-500">Three steps to academic dominance.</p>
        </div>

        <div className="mt-12 space-y-7">
          {methodologySteps.map((step) => (
            <article
              key={step.title}
              className={[
                "overflow-hidden rounded-[18px] px-6 py-8 shadow-[0_24px_46px_-36px_rgba(15,23,42,0.7)] sm:px-10 sm:py-10",
                step.tone === "amber" ? "bg-[#f49700] text-[#0f172a]" : "",
                step.tone === "navy" ? "bg-[#1b2740] text-white" : "",
                step.tone === "ink" ? "bg-[#091222] text-white" : "",
              ].join(" ")}
            >
              <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-center">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.26em] text-current/75">
                    {step.phase}
                  </p>
                  <h3 className="mt-4 font-sans text-[1.9rem] font-extrabold tracking-[-0.05em] sm:text-[2.35rem]">
                    {step.title}
                  </h3>
                  <p className="mt-4 max-w-[520px] text-sm leading-7 text-current/75 sm:text-base">
                    {step.description}
                  </p>
                </div>

                <div className="mx-auto w-full max-w-[230px]">
                  {step.tone === "amber" ? <MethodologyFoundationGraphic /> : null}
                  {step.tone === "navy" ? <MethodologyArenaGraphic /> : null}
                  {step.tone === "ink" ? <MethodologyTrackGraphic /> : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="shell py-20 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_470px] lg:items-end">
          <div>
            <h2 className="max-w-[420px] font-sans text-[2.35rem] font-extrabold leading-[0.92] tracking-[-0.06em] text-[#0d1b2a] sm:text-[3rem]">
              Built for modern school administrators
            </h2>

            <div className="mt-10 flex flex-wrap gap-4">
              <div className="min-w-[154px] rounded-[18px] bg-[#f7f0e2] px-5 py-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                <p className="text-[2rem] font-extrabold tracking-[-0.05em] text-[#f49700]">98%</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Engagement
                </p>
              </div>
              <div className="min-w-[154px] rounded-[18px] bg-white px-5 py-5 shadow-[0_18px_40px_-34px_rgba(15,23,42,0.45)]">
                <p className="text-[2rem] font-extrabold tracking-[-0.05em] text-[#0f172a]">2.4x</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Velocity
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] bg-[#f49700] p-4 shadow-[0_28px_70px_-44px_rgba(15,23,42,0.85)]">
            <div className="-rotate-[2deg] rounded-[22px] bg-white px-6 py-7 shadow-[0_18px_44px_-26px_rgba(15,23,42,0.25)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                    Engagement Metrics
                  </p>
                  <h3 className="mt-2 font-sans text-lg font-extrabold tracking-[-0.04em] text-[#0d1b2a]">
                    Impact overview
                  </h3>
                </div>
                <Trophy className="size-5 text-[#f49700]" />
              </div>

              <div className="mt-7 space-y-5">
                {[
                  { label: "Participation", width: "w-[95%]", accent: "bg-[#f49700]" },
                  { label: "Throughput", width: "w-[78%]", accent: "bg-[#0f172a]" },
                  { label: "Retention", width: "w-[88%]", accent: "bg-[#f8c469]" },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-600">{item.label}</span>
                      <span className="text-slate-400">{item.width.replace(/[^\d]/g, "")}%</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${item.width} ${item.accent}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-32 rounded-t-[3.25rem] bg-[#0f172a] py-20 text-white sm:rounded-t-[4rem] sm:py-24"
      >
        <div className="shell">
          <div className="mx-auto max-w-[600px] text-center">
            <h2 className="font-sans text-[2rem] font-extrabold tracking-[-0.05em] sm:text-[2.35rem]">
              Choose Your Track
            </h2>
            <p className="mt-3 text-base text-slate-300">
              Scale your competitive ecosystem as your school grows.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {pricingTiers.map((tier) => (
              <article
                key={tier.name}
                className={[
                  "relative rounded-[28px] border px-8 py-8 shadow-[0_24px_50px_-34px_rgba(2,6,23,0.95)]",
                  tier.featured
                    ? "border-[#f49700] bg-[#f49700] text-white"
                    : "border-slate-700 bg-[#1e293b] text-white",
                ].join(" ")}
              >
                {tier.featured ? (
                  <div className="absolute right-7 top-[-12px] rounded-full bg-white px-4 py-1 text-[0.65rem] font-extrabold uppercase tracking-[0.18em] text-[#f49700]">
                    Most Popular
                  </div>
                ) : null}

                <h3 className="font-sans text-xl font-bold tracking-[-0.03em]">{tier.name}</h3>
                <p className="mt-3 flex items-end gap-1">
                  <span className="font-sans text-[2.35rem] font-extrabold tracking-[-0.05em]">
                    {tier.price}
                  </span>
                  <span className={tier.featured ? "text-white/60" : "text-slate-400"}>
                    {tier.suffix}
                  </span>
                </p>

                <ul className="mt-8 space-y-3 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2.5">
                      <Check className="size-4 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={[
                    "mt-8 h-12 w-full rounded-2xl text-sm font-bold",
                    tier.featured
                      ? "bg-white text-[#f49700] hover:bg-slate-100"
                      : "bg-[#334155] text-white hover:bg-[#3f4d62]",
                  ].join(" ")}
                >
                  {tier.cta}
                </Button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="mt-14 w-full max-w-[990px] rounded-[18px] border border-[#e7ebf0] bg-white shadow-[0_18px_44px_-30px_rgba(15,23,42,0.35)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eef2f6] bg-[#fafcfd] px-5 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-3 rounded-full bg-[#f87171]" />
            <span className="size-3 rounded-full bg-[#fbbf24]" />
            <span className="size-3 rounded-full bg-[#34d399]" />
          </div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Live Admin Dashboard
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-md bg-[#d1fae5] px-2.5 py-1 font-semibold text-[#047857]">
            Active: 1,240 students
          </span>
          <span className="font-medium text-slate-400">
            {hasEnvVars ? "v2.4.0" : "Setup pending"}
          </span>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_230px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Avg. Score", value: "84.2%" },
              { label: "Completion", value: "92%" },
              { label: "Time Left", value: "14:22", accent: true },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[#eef2f6] bg-[#f8fafc] px-4 py-4 text-left">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {item.label}
                </p>
                <p
                  className={[
                    "mt-2 font-sans text-2xl font-extrabold tracking-[-0.04em]",
                    item.accent ? "text-[#f49700]" : "text-[#0d1b2a]",
                  ].join(" ")}
                >
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-[16px] border border-[#eef2f6] bg-[#f8fafc] px-5 pb-5 pt-4">
            <div className="flex items-end gap-3">
              {[42, 58, 52, 84, 60, 92, 55, 68].map((height, index) => (
                <div key={`${height}-${index}`} className="flex flex-1 items-end justify-center">
                  <div
                    className={[
                      "w-full rounded-t-[8px]",
                      index === 3 || index === 5 ? "bg-[#f49700]" : "bg-[#f8c469]",
                    ].join(" ")}
                    style={{ height: `${height * 1.25}px` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="rounded-[16px] border border-[#eef2f6] bg-white px-4 py-5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.2)]">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[#34b693]">
            Smartboard
          </p>
          <div className="mt-4 space-y-3">
            {leaderboardRows.map((row, index) => (
              <div key={row.name} className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0d1b2a]">{row.name}</p>
                    <p className="text-xs text-slate-400">Score</p>
                  </div>
                  <span className="text-sm font-bold text-[#0d1b2a]">{row.score}</span>
                </div>
                <div className="h-2 rounded-full bg-[#edf1f5]">
                  <div
                    className={[
                      "h-full rounded-full",
                      index === 0 ? "bg-[#f49700]" : "bg-[#0d1b2a]",
                      row.accent,
                    ].join(" ")}
                  />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function FeatureStackIcon() {
  return (
    <div className="relative mx-auto h-full max-w-[220px]">
      <div className="absolute left-16 top-9 h-32 w-24 -rotate-6 rounded-[10px] bg-[#f49700]/35 shadow-[0_20px_30px_-22px_rgba(15,23,42,0.25)]" />
      <div className="absolute left-[78px] top-5 h-32 w-24 rotate-[5deg] rounded-[10px] bg-[#f49700]/60 shadow-[0_20px_30px_-22px_rgba(15,23,42,0.25)]" />
      <div className="absolute left-[92px] top-0 flex h-32 w-24 items-center justify-center rounded-[10px] bg-[#f49700] shadow-[0_24px_40px_-24px_rgba(15,23,42,0.35)]">
        <div className="grid gap-2">
          <span className="h-2.5 w-12 rounded-full bg-white/95" />
          <span className="h-2.5 w-16 rounded-full bg-white/80" />
          <span className="h-2.5 w-10 rounded-full bg-white/70" />
        </div>
      </div>
    </div>
  );
}

function FeatureLeaderboardIcon() {
  return (
    <div className="grid h-full gap-3">
      {[["w-28", "w-10"], ["w-20", "w-8"], ["w-24", "w-9"]].map(([left, right]) => (
        <div key={`${left}-${right}`} className="flex h-10 items-center justify-between rounded-md bg-[#0d1b2a] px-4">
          <span className={`h-2 rounded-full bg-[#f49700] ${left}`} />
          <span className={`h-2 rounded-full bg-[#f49700]/50 ${right}`} />
        </div>
      ))}
    </div>
  );
}

function FeatureSchedulerIcon() {
  return (
    <div className="grid h-full grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className={[
            "rounded-[6px]",
            index === 1 || index === 6 ? "bg-[#f49700]/25" : "bg-[#dfe5eb]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function MethodologyFoundationGraphic() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[210px] rounded-full border border-current/50">
      <div className="absolute inset-[18%] rounded-full border border-current/35" />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-current/70" />
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-current/70" />
      <span className="absolute left-[10%] top-[16%] text-xs font-semibold tracking-[0.12em]">
        r = 6
      </span>
      <span className="absolute right-[12%] top-[22%] text-xs font-semibold tracking-[0.12em]">
        f(x)
      </span>
      <span className="absolute bottom-[16%] right-[16%] text-xs font-semibold tracking-[0.12em]">
        2π
      </span>
    </div>
  );
}

function MethodologyArenaGraphic() {
  return (
    <div className="grid h-[150px] grid-cols-5 gap-2 rounded-[12px] bg-white/5 p-4">
      {Array.from({ length: 15 }).map((_, index) => (
        <div
          key={index}
          className={[
            "rounded-[4px] border border-white/5",
            index === 9 ? "bg-[#f49700]/30" : "bg-white/10",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function MethodologyTrackGraphic() {
  return (
    <div className="relative h-[150px] overflow-hidden rounded-[12px] border border-[#f49700]/35">
      <div className="absolute bottom-6 left-4 right-4 h-px bg-[#f49700]" />
      <div className="absolute bottom-4 left-8 top-4 w-px bg-[#f49700]" />
      <div className="absolute left-9 top-[58%] h-[58px] w-[58px] rounded-[100%_70%_100%_70%] border-l-2 border-t-2 border-[#f49700]" />
      <div className="absolute bottom-7 left-[74px] h-[72px] w-[86px] rounded-[72%_28%_58%_42%] border-r-2 border-t-2 border-[#f49700]" />
      <div className="absolute right-9 top-8 size-3 rounded-full bg-[#f49700]" />
    </div>
  );
}
