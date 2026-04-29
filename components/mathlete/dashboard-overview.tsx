import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  ShieldCheck,
  Users2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProgressLink } from "@/components/ui/progress-link";

export type MathleteLiveCard = {
  id: string;
  title: string;
  mode: string;
  enrolled: string;
  action: string;
  href?: string;
};

export type MathleteUpcomingCard = {
  id: string;
  title: string;
  type: string;
  dateLabel: string;
  timestamp: string | null;
  countdown: {
    days: string;
    hours: string;
    minutes: string;
  };
  href?: string;
};

export type MathleteActivityItem = {
  id: string;
  message: string;
  timestampLabel: string;
};

export type MathleteRegistrationCard = {
  id: string;
  title: string;
  status: string;
  format: string;
  dateLabel: string;
  registeredLabel: string;
  href: string;
};

type MathleteDashboardOverviewProps = {
  displayName: string;
  profileComplete: boolean;
  liveCards: MathleteLiveCard[];
  upcomingCards: MathleteUpcomingCard[];
  registrationCards: MathleteRegistrationCard[];
  activityItems: MathleteActivityItem[];
};

function CountdownCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[52px] flex-col items-center gap-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-sm font-black text-[#1a1e2e] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        {value}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-[0.22em] text-slate-400">
        {label}
      </span>
    </div>
  );
}

function buildCalendarRows(cards: MathleteUpcomingCard[]) {
  const datedCards = cards
    .map((card) => (card.timestamp ? new Date(card.timestamp) : null))
    .filter((date): date is Date => date !== null && !Number.isNaN(date.getTime()))
    .sort((left, right) => left.getTime() - right.getTime());

  const baseDate = datedCards[0] ?? new Date();
  const monthLabel = baseDate.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay }, () => "") as string[];

  for (let day = 1; day <= lastDate; day += 1) {
    cells.push(String(day));
  }

  while (cells.length % 7 !== 0) {
    cells.push("");
  }

  const rows = Array.from({ length: cells.length / 7 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7),
  );
  const selectedDay =
    datedCards[0] && datedCards[0].getMonth() === month && datedCards[0].getFullYear() === year
      ? String(datedCards[0].getDate())
      : null;
  const accentDays = new Set(datedCards.map((date) => String(date.getDate())));

  return { monthLabel, rows, selectedDay, accentDays };
}

function MetricCard({
  label,
  value,
  detail,
  accent = "light",
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "light" | "dark";
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 shadow-sm transition-all",
        accent === "dark"
          ? "border-[#1a1e2e] bg-[#1a1e2e] text-white"
          : "border-slate-100 bg-white text-[#0f1c2c]",
      ].join(" ")}
    >
      <p
        className={[
          "text-[11px] font-bold uppercase tracking-[0.24em]",
          accent === "dark" ? "text-white/50" : "text-slate-400",
        ].join(" ")}
      >
        {label}
      </p>
      <p className="mt-3 text-3xl font-black tracking-normal">{value}</p>
      <p className={["mt-2 text-sm", accent === "dark" ? "text-white/68" : "text-slate-500"].join(" ")}>
        {detail}
      </p>
    </div>
  );
}

function hasActiveCountdown(countdown: MathleteUpcomingCard["countdown"]) {
  return countdown.days !== "00" || countdown.hours !== "00" || countdown.minutes !== "00";
}

export function MathleteDashboardOverview({
  displayName,
  profileComplete,
  liveCards,
  upcomingCards,
  registrationCards,
  activityItems,
}: MathleteDashboardOverviewProps) {
  const resolvedLiveCards = liveCards;
  const resolvedUpcomingCards = upcomingCards.filter((card) => hasActiveCountdown(card.countdown));
  const resolvedActivityItems = activityItems;
  const { monthLabel, rows, selectedDay, accentDays } = buildCalendarRows(resolvedUpcomingCards);
  const nextEvent = resolvedUpcomingCards[0];

  return (
    <section className="shell space-y-8 pb-16 pt-8 md:space-y-10 md:pt-10">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#f49700]">
            Mathlete dashboard
          </p>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal text-[#0f1c2c] md:text-[3.5rem]">
              Welcome back, <span className="text-[#f49700]">{displayName}</span>
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-500 md:text-base">
              Track live competitions, your next registration window, and the team workspace from one
              clean MathWiz control panel.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 xl:min-w-[540px]">
          <MetricCard
            label="Live now"
            value={String(resolvedLiveCards.length).padStart(2, "0")}
            detail="Active competitions in your orbit."
          />
          <MetricCard
            label="Registered"
            value={String(registrationCards.length).padStart(2, "0")}
            detail="Competitions on your roster."
          />
          <MetricCard
            label="Profile"
            value={profileComplete ? "Ready" : "Update"}
            detail={profileComplete ? "School and grade are complete." : "Finish your profile to unlock clean team setup."}
            accent="dark"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-10">
          <section id="competitions" className="scroll-mt-28 space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[22px] font-black uppercase tracking-[0.08em] text-[#1a1e2e]">
                Live now
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {resolvedLiveCards.length > 0 ? resolvedLiveCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-200 hover:shadow-[0_24px_44px_-32px_rgba(15,23,42,0.28)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#f49700]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f49700]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#f49700]" />
                      Live
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-[#1a1e2e]"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </div>

                  <div className="mt-6 space-y-4">
                    <h3 className="text-[1.7rem] font-black leading-tight tracking-normal text-[#0f1c2c]">
                      {card.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-[13px] font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Users2 className="size-4" />
                        {card.mode}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users2 className="size-4" />
                        {card.enrolled}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    {card.href ? (
                      <Button
                        asChild
                        className="h-12 w-full rounded-xl bg-[#1a1e2e] text-sm font-bold text-white shadow-lg shadow-[#0f1c2c]/20 hover:bg-[#0f121a]"
                      >
                        <ProgressLink href={card.href}>{card.action}</ProgressLink>
                      </Button>
                    ) : (
                      <div className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#1a1e2e] text-sm font-bold text-white">
                        {card.action}
                      </div>
                    )}
                  </div>
                </article>
              )) : (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-6 text-sm font-medium text-slate-500 md:col-span-2">
                  No registered competitions are live right now.
                </div>
              )}
            </div>
          </section>

          <section id="registrations" className="scroll-mt-28 space-y-5">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-[22px] font-black uppercase tracking-[0.08em] text-[#1a1e2e]">
                My registrations
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
                {registrationCards.length} tracked
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {registrationCards.length > 0 ? registrationCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm"
                >
                  <div className="space-y-3">
                    <span className="inline-flex rounded-full bg-[#f49700]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#f49700]">
                      {card.status}
                    </span>
                    <h3 className="text-[1.25rem] font-black leading-tight tracking-normal text-[#0f1c2c]">
                      {card.title}
                    </h3>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Users2 className="size-3.5" />
                      {card.format}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      {card.dateLabel}
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {card.registeredLabel}
                    </span>
                    <Button
                      asChild
                      className="h-10 rounded-xl bg-[#1a1e2e] px-5 text-sm font-bold text-white shadow-lg shadow-[#0f1c2c]/20 hover:bg-[#0f121a]"
                    >
                      <ProgressLink href={card.href}>View details</ProgressLink>
                    </Button>
                  </div>
                </article>
              )) : (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-6 text-sm font-medium text-slate-500 md:col-span-2">
                  Registered competitions will appear here after you join an event.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-end justify-between gap-3">
              <h2 className="text-[22px] font-black uppercase tracking-[0.08em] text-[#1a1e2e]">
                Upcoming competitions
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-slate-400">
                All upcoming
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {resolvedUpcomingCards.length > 0 ? resolvedUpcomingCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-slate-200 hover:shadow-[0_24px_44px_-32px_rgba(15,23,42,0.28)]"
                >
                  <div className="space-y-4">
                    <h3 className="text-[1.25rem] font-black leading-tight tracking-normal text-[#0f1c2c]">
                      {card.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-[12px] font-medium text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Users2 className="size-3.5" />
                        {card.type}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" />
                        {card.dateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-200 pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-2.5">
                        <CountdownCell label="Days" value={card.countdown.days} />
                        <CountdownCell label="Hours" value={card.countdown.hours} />
                        <CountdownCell label="Min" value={card.countdown.minutes} />
                      </div>

                      {card.href ? (
                        <Button
                          asChild
                          className="h-11 rounded-xl bg-[#f49700] px-5 text-sm font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-[#f49700]/30 hover:bg-[#e08900]"
                        >
                          <ProgressLink href={card.href} className="inline-flex items-center gap-2">
                            View details
                            <ArrowRight className="size-4" />
                          </ProgressLink>
                        </Button>
                      ) : (
                        <div className="inline-flex h-11 items-center justify-center rounded-xl bg-[#f49700] px-5 text-sm font-black uppercase tracking-[0.14em] text-white">
                          View details
                          <ArrowRight className="ml-2 size-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              )) : (
                <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-6 text-sm font-medium text-slate-500 md:col-span-2">
                  Registered upcoming competitions will appear here.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <aside className="rounded-3xl bg-[#1a1e2e] p-7 text-white shadow-xl shadow-[#0f121a]/20">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-[14px] font-bold uppercase tracking-[0.28em] text-white">
                {monthLabel}
              </h2>
              <div className="flex items-center gap-2 text-slate-500">
                <span>&lsaquo;</span>
                <span>&rsaquo;</span>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-7 gap-y-4 text-center">
              {["SU", "MO", "TU", "WE", "TH", "FR", "SA"].map((day) => (
                <span key={day} className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                  {day}
                </span>
              ))}

              {rows.flat().map((day, index) => {
                if (!day) {
                  return <span key={`empty-${index}`} className="h-8" aria-hidden="true" />;
                }

                const isToday = day === selectedDay;
                const hasDot = accentDays.has(day) && !isToday;

                return (
                  <div key={`${day}-${index}`} className="relative flex justify-center">
                    <span
                      className={[
                        "flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold",
                        isToday ? "bg-[#f49700] text-white" : "text-white",
                      ].join(" ")}
                    >
                      {day}
                    </span>
                    {hasDot ? <span className="absolute bottom-0 h-1 w-1 rounded-full bg-[#f49700]" /> : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">
                Next event
              </p>
              <div className="mt-4 flex items-center gap-4 rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f49700]/16 text-[#f49700]">
                  <CalendarDays className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {nextEvent?.title ?? "No scheduled competition"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {nextEvent?.dateLabel ?? "Published events will appear here."}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <aside
            id="history"
            className="scroll-mt-28 rounded-3xl border border-slate-100 bg-white p-7 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-black tracking-normal text-[#0f1c2c]">
                Recent activity
              </h2>
              <Bell className="size-4 text-slate-400" />
            </div>

            <div className="mt-6 space-y-5">
              {resolvedActivityItems.length > 0 ? resolvedActivityItems.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                  <div
                    className={[
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      index === 0
                        ? "border-[#f49700]/20 bg-[#f49700]/10 text-[#f49700]"
                        : index === 1
                          ? "border-orange-100 bg-orange-50 text-[#f49700]"
                          : "border-slate-200 bg-slate-50 text-slate-500",
                    ].join(" ")}
                  >
                    {index === 0 ? <CheckCircle2 className="size-4" /> : index === 1 ? <Bell className="size-4" /> : <Clock3 className="size-4" />}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold leading-6 text-[#1a1e2e]">
                      {item.message}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                      <Clock3 className="size-3" />
                      {item.timestampLabel}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-500">
                  Your registration history will appear after you join a competition.
                </p>
              )}
            </div>

            <div className="mt-8 rounded-[1.5rem] bg-[#fafafb] p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1e2e] text-white">
                  <ShieldCheck className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#1a1e2e]">
                    {profileComplete ? "Team workspace is unlocked" : "Finish your profile next"}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {profileComplete
                      ? "Jump into squads, invites, and roster prep without leaving the dashboard."
                      : "Add your school and grade level so team setup feels complete."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <Button
                asChild
                className="h-12 w-full rounded-xl bg-[#1a1e2e] text-sm font-bold text-white shadow-lg shadow-[#0f1c2c]/20 hover:bg-[#0f121a]"
              >
                <ProgressLink href={profileComplete ? "/mathlete/teams" : "/mathlete/settings"}>
                  {profileComplete ? "Open Team Workspace" : "Finish Profile Setup"}
                </ProgressLink>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
