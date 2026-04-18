import { ArrowRight, Bell, CalendarDays, Clock3, Search, Users2 } from "lucide-react";
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

type MathleteDashboardOverviewProps = {
  displayName: string;
  profileComplete: boolean;
  liveCards: MathleteLiveCard[];
  upcomingCards: MathleteUpcomingCard[];
  activityItems: MathleteActivityItem[];
};

const fallbackLiveCards: MathleteLiveCard[] = [
  {
    id: "live-1",
    title: "2024 National Math Olympiad",
    mode: "Individual",
    enrolled: "428 Enrolled",
    action: "Enter Arena",
  },
  {
    id: "live-2",
    title: "2024 National Math Olympiad",
    mode: "Individual",
    enrolled: "428 Enrolled",
    action: "Resume",
  },
];

const fallbackUpcomingCards: MathleteUpcomingCard[] = [
  {
    id: "upcoming-1",
    title: "Algebraic Geometry Sprint 2026",
    type: "Team (3-4)",
    dateLabel: "Oct 24, 2026",
    timestamp: "2026-10-24T09:00:00.000Z",
    countdown: { days: "02", hours: "14", minutes: "30" },
  },
  {
    id: "upcoming-2",
    title: "Combinatorics Clash 2026",
    type: "Individual",
    dateLabel: "Nov 02, 2026",
    timestamp: "2026-11-02T09:00:00.000Z",
    countdown: { days: "11", hours: "08", minutes: "12" },
  },
  {
    id: "upcoming-3",
    title: "Euler Marathon",
    type: "Individual",
    dateLabel: "Nov 14, 2026",
    timestamp: "2026-11-14T09:00:00.000Z",
    countdown: { days: "18", hours: "03", minutes: "42" },
  },
  {
    id: "upcoming-4",
    title: "Vector Relay",
    type: "Team (2-5)",
    dateLabel: "Nov 27, 2026",
    timestamp: "2026-11-27T09:00:00.000Z",
    countdown: { days: "29", hours: "21", minutes: "09" },
  },
];

const fallbackActivityItems: MathleteActivityItem[] = [
  { id: "activity-1", message: "Team workspace synced and ready for invites.", timestampLabel: "2 minutes ago" },
  { id: "activity-2", message: "Profile settings available for school and grade updates.", timestampLabel: "Today" },
  { id: "activity-3", message: "Navigation upgraded to match current Mathlete shell.", timestampLabel: "Just now" },
];

function CountdownCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-[52px] flex-col items-center gap-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50 text-sm font-black text-[#0d1b2a] shadow-[0_10px_24px_-20px_rgba(15,23,42,0.45)]">
        {value}
      </div>
      <span className="text-[8px] font-bold uppercase tracking-[0.24em] text-slate-400">
        {label}
      </span>
    </div>
  );
}

function buildCalendarRows(cards: MathleteUpcomingCard[]) {
  const datedCards = cards
    .map((card) => (card.timestamp ? new Date(card.timestamp) : null))
    .filter((date): date is Date => Boolean(date) && !Number.isNaN(date.getTime()))
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

export function MathleteDashboardOverview({
  displayName,
  profileComplete,
  liveCards,
  upcomingCards,
  activityItems,
}: MathleteDashboardOverviewProps) {
  const resolvedLiveCards = liveCards.length > 0 ? liveCards : fallbackLiveCards;
  const resolvedUpcomingCards = upcomingCards.length > 0 ? upcomingCards : fallbackUpcomingCards;
  const resolvedActivityItems = activityItems.length > 0 ? activityItems : fallbackActivityItems;
  const { monthLabel, rows, selectedDay, accentDays } = buildCalendarRows(resolvedUpcomingCards);
  const nextEvent = resolvedUpcomingCards[0];

  return (
    <section className="shell space-y-8 pb-16 pt-8 md:space-y-10 md:pt-10">
      <div className="overflow-hidden rounded-[2rem] bg-[#10182b] px-6 py-10 text-white shadow-[0_32px_80px_-40px_rgba(15,23,42,0.7)] md:px-10 md:py-14">
        <div className="mx-auto max-w-[720px] space-y-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.36em] text-[#f49700]">
            Mathlete
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.06em] text-white md:text-7xl">
              Welcome back,
            </h1>
            <p className="font-display text-5xl font-semibold leading-none tracking-[-0.06em] text-[#f49700] md:text-7xl">
              {displayName}
            </p>
          </div>
          <p className="mx-auto max-w-2xl text-sm leading-7 text-white/68 md:text-base">
            Search, track, and prepare from one mathlete home base. Live competition entry still routes through protected competition flows as those pages land.
          </p>
        </div>

        <form action="/mathlete" className="mx-auto mt-8 max-w-[720px] rounded-[1.35rem] border border-white/10 bg-white/10 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="flex min-h-[56px] flex-1 items-center gap-3 rounded-2xl px-4 text-white/45">
              <Search className="size-5" />
              <input
                type="search"
                name="q"
                placeholder="Find competitions by name, topic, or school..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/45 md:text-base"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#f49700] px-6 text-sm font-bold uppercase tracking-[0.14em] text-white"
              >
                Search
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,395px)]">
        <div className="space-y-8">
          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-[-0.04em] text-[#0d1b2a]">
                Live Now
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {resolvedLiveCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_28px_48px_-36px_rgba(15,23,42,0.35)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Live
                      </span>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-300"
                      aria-label="More actions"
                    >
                      •••
                    </button>
                  </div>

                  <div className="mt-6 space-y-3">
                    <h3 className="font-display text-3xl font-semibold leading-[1.05] tracking-[-0.05em] text-[#0d1b2a]">
                      {card.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-2">
                        <Users2 className="size-4" />
                        {card.mode}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Users2 className="size-4" />
                        {card.enrolled}
                      </span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <div
                      aria-disabled="true"
                      className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#00112b] text-base font-bold text-white"
                    >
                      {card.action}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl font-semibold uppercase tracking-[-0.04em] text-[#0d1b2a]">
                Upcoming Competitions
              </h2>
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
                All Upcoming
              </span>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {resolvedUpcomingCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-[1.7rem] border border-slate-100 bg-white p-5 shadow-[0_28px_48px_-36px_rgba(15,23,42,0.18)]"
                >
                  <div className="space-y-3">
                    <h3 className="font-display text-[2rem] font-semibold leading-[1.05] tracking-[-0.05em] text-[#0d1b2a]">
                      {card.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Users2 className="size-3.5" />
                        {card.type}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="size-3.5" />
                        {card.dateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
                    <div className="flex items-start gap-2.5">
                      <CountdownCell label="Days" value={card.countdown.days} />
                      <CountdownCell label="Hours" value={card.countdown.hours} />
                      <CountdownCell label="Min" value={card.countdown.minutes} />
                    </div>
                    <div
                      aria-disabled="true"
                      className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#f49700] px-6 text-sm font-bold text-white"
                    >
                      Register Now
                      <ArrowRight className="ml-2 size-4" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <aside className="rounded-[2rem] bg-[#10182b] p-6 text-white shadow-[0_32px_64px_-40px_rgba(15,23,42,0.85)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-bold uppercase tracking-[0.22em] text-white">
                {monthLabel}
              </h2>
              <div className="flex items-center gap-2 text-white/70">
                <span>&lsaquo;</span>
                <span>&rsaquo;</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-7 gap-y-4 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <span key={day} className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
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
                        "flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold",
                        isToday ? "bg-[#f97316] text-white" : "text-white",
                      ].join(" ")}
                    >
                      {day}
                    </span>
                    {hasDot ? <span className="absolute bottom-0 h-1 w-1 rounded-full bg-[#f97316]" /> : null}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 border-t border-white/10 pt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
                Next Event
              </p>
              <div className="mt-4 rounded-2xl bg-white/6 p-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f49700]/12 text-[#f49700]">
                    <CalendarDays className="size-4" />
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
            </div>
          </aside>

          <aside className="rounded-[1.7rem] border border-slate-100 bg-white p-6 shadow-[0_28px_48px_-36px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[#1a1e2e]">
                Recent Activity
              </h2>
              <Bell className="size-4 text-slate-300" />
            </div>

            <div className="mt-5 space-y-4">
              {resolvedActivityItems.map((item) => (
                <div key={item.id} className="flex items-start gap-4">
                  <div className="mt-0.5 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                    <Clock3 className="size-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold leading-5 text-slate-700">
                      {item.message}
                    </p>
                    <p className="text-xs text-slate-400">{item.timestampLabel}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Button
                asChild
                variant="outline"
                className="h-11 w-full rounded-2xl border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700"
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
