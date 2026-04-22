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
    enrolled: "428 enrolled",
    action: "Enter Arena",
  },
  {
    id: "live-2",
    title: "2024 National Math Olympiad",
    mode: "Individual",
    enrolled: "428 enrolled",
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
  {
    id: "activity-1",
    message: "Your registration for Algebraic Geometry Sprint was successful.",
    timestampLabel: "2 minutes ago",
  },
  {
    id: "activity-2",
    message: "Your team workspace is synced and ready for new invites.",
    timestampLabel: "Today",
  },
  {
    id: "activity-3",
    message: "Finish your profile to unlock a cleaner team matchmaking flow.",
    timestampLabel: "Just now",
  },
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
        "rounded-[1.75rem] border p-5 shadow-[0_20px_48px_-38px_rgba(15,23,42,0.32)]",
        accent === "dark"
          ? "border-[#1a1e2e] bg-[#1a1e2e] text-white"
          : "border-white/80 bg-white text-[#1a1e2e]",
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
      <p className="mt-3 text-3xl font-black tracking-[-0.05em]">{value}</p>
      <p className={["mt-2 text-sm", accent === "dark" ? "text-white/68" : "text-slate-500"].join(" ")}>
        {detail}
      </p>
    </div>
  );
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
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.34em] text-[#f49700]">
            Mathlete dashboard
          </p>
          <div className="space-y-3">
            <h1 className="max-w-3xl text-4xl font-black leading-[1.02] tracking-[-0.06em] text-[#1a1e2e] md:text-[3.5rem]">
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
            label="Upcoming"
            value={String(resolvedUpcomingCards.length).padStart(2, "0")}
            detail="Published events worth planning for."
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
              {resolvedLiveCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_44px_-28px_rgba(15,23,42,0.28)]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                    <h3 className="text-[1.7rem] font-black leading-tight tracking-[-0.04em] text-[#1a1e2e]">
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
                        className="h-12 w-full rounded-full bg-[#1a1e2e] text-sm font-bold text-white hover:bg-[#0f121a]"
                      >
                        <ProgressLink href={card.href}>{card.action}</ProgressLink>
                      </Button>
                    ) : (
                      <div className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#1a1e2e] text-sm font-bold text-white">
                        {card.action}
                      </div>
                    )}
                  </div>
                </article>
              ))}
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
              {resolvedUpcomingCards.map((card) => (
                <article
                  key={card.id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-1 hover:shadow-[0_24px_44px_-28px_rgba(15,23,42,0.28)]"
                >
                  <div className="space-y-4">
                    <h3 className="text-[1.25rem] font-black leading-tight tracking-[-0.03em] text-[#1a1e2e]">
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
                          className="h-11 rounded-full bg-[#f49700] px-5 text-sm font-bold text-white hover:bg-[#e68b00]"
                        >
                          <ProgressLink href={card.href} className="inline-flex items-center gap-2">
                            Register
                            <ArrowRight className="size-4" />
                          </ProgressLink>
                        </Button>
                      ) : (
                        <div className="inline-flex h-11 items-center justify-center rounded-full bg-[#f49700] px-5 text-sm font-bold text-white">
                          Register
                          <ArrowRight className="ml-2 size-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <aside className="rounded-[2rem] bg-[#1a1e2e] p-7 text-white shadow-[0_28px_60px_-34px_rgba(15,18,26,0.86)]">
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
            className="scroll-mt-28 rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.2)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-black tracking-[-0.03em] text-[#1a1e2e]">
                Recent activity
              </h2>
              <Bell className="size-4 text-slate-400" />
            </div>

            <div className="mt-6 space-y-5">
              {resolvedActivityItems.map((item, index) => (
                <div key={item.id} className="flex gap-4">
                  <div
                    className={[
                      "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
                      index === 0
                        ? "border-emerald-100 bg-emerald-50 text-emerald-500"
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
              ))}
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
                className="h-12 w-full rounded-full bg-[#1a1e2e] text-sm font-bold text-white hover:bg-[#0f121a]"
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
