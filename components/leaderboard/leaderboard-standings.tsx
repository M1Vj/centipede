import type { ReactNode } from "react";
import type { CompetitionFormat } from "@/lib/competition/types";
import type { LeaderboardEntry } from "@/lib/leaderboard/types";
import { cn } from "@/lib/utils";

type LeaderboardStandingsProps = {
  entries: LeaderboardEntry[];
  format: CompetitionFormat;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

type PodiumTone = {
  badge: string;
  card: string;
  copy: string;
  label: string;
  muted: string;
  rank: string;
  score: string;
};

const PODIUM_TONES: Record<1 | 2 | 3, PodiumTone> = {
  1: {
    badge: "border-white/20 bg-white/10 text-white",
    card: "bg-[linear-gradient(135deg,#f49700_0%,#885200_100%)] text-white shadow-xl shadow-[#f49700]/20",
    copy: "text-white",
    label: "The champion",
    muted: "text-white/70",
    rank: "text-white/20",
    score: "text-white",
  },
  2: {
    badge: "border-white/10 bg-white/10 text-white/80",
    card: "bg-[linear-gradient(135deg,#1a1e2e_0%,#0f1c2c_100%)] text-white shadow-xl shadow-[#0f1c2c]/20",
    copy: "text-white",
    label: "The challenger",
    muted: "text-white/60",
    rank: "text-white/10",
    score: "text-white/80",
  },
  3: {
    badge: "border-slate-200 bg-white/70 text-slate-500",
    card: "border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f1f5f9_100%)] text-[#0f1c2c] shadow-sm",
    copy: "text-[#0f1c2c]",
    label: "The rising force",
    muted: "text-slate-500",
    rank: "text-[#0f1c2c]/10",
    score: "text-[#f49700]",
  },
};

function entityLabel(format: CompetitionFormat) {
  return format === "team" ? "Team" : "Participant";
}

function pluralEntityLabel(format: CompetitionFormat, count: number) {
  const label = entityLabel(format).toLowerCase();
  return `${count} ${label}${count === 1 ? "" : "s"} ranked`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0s";
  }

  const wholeSeconds = Math.trunc(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainder = wholeSeconds % 60;

  if (minutes === 0) {
    return `${wholeSeconds}s`;
  }

  return `${minutes}m ${remainder.toString().padStart(2, "0")}s`;
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const rank = entry.rank === 1 || entry.rank === 2 || entry.rank === 3 ? entry.rank : 3;
  const tone = PODIUM_TONES[rank];
  const alignClass = rank === 2 ? "items-end text-right" : "items-start text-left";
  const rankPosition = rank === 2 ? "left-3 sm:left-6" : "right-3 sm:right-6";

  return (
    <article
      className={cn(
        "relative isolate min-h-[220px] overflow-hidden rounded-[32px] border border-transparent px-6 py-7 sm:min-h-[260px] sm:px-8 lg:px-10",
        "transition-all duration-300 hover:border-[#f49700]/50 hover:shadow-md",
        tone.card,
        rank === 1 && "sm:min-h-[300px]",
        rank === 2 && "sm:min-h-[270px]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 -z-10 -translate-y-1/2 text-[10rem] font-black leading-none sm:text-[16rem] lg:text-[20rem]",
          rankPosition,
          tone.rank,
        )}
      >
        {entry.rank.toString().padStart(2, "0")}
      </span>

      <div className={cn("flex h-full min-w-0 flex-col justify-center gap-5", alignClass)}>
        <span
          className={cn(
            "inline-flex w-fit rounded-full border px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.22em]",
            tone.badge,
          )}
        >
          {tone.label}
        </span>
        <div className="min-w-0 space-y-4">
          <h3
            className={cn(
              "break-words text-4xl font-black uppercase leading-[0.95] tracking-normal sm:text-5xl lg:text-6xl",
              tone.copy,
              rank === 1 && "lg:text-7xl",
            )}
          >
            {entry.displayName}
          </h3>
          <div
            className={cn(
              "flex flex-wrap items-baseline gap-x-5 gap-y-2",
              rank === 2 && "justify-end",
            )}
          >
            <span className={cn("text-3xl font-black sm:text-4xl", tone.score)}>
              {entry.score.toLocaleString()}
            </span>
            <span className={cn("text-xs font-black uppercase tracking-[0.22em]", tone.muted)}>
              points earned
            </span>
          </div>
        </div>

        <dl
          className={cn(
            "flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.12em]",
            rank === 2 && "justify-end",
          )}
        >
          <div className="rounded-full bg-white/10 px-3 py-1.5">
            <dt className="sr-only">Time</dt>
            <dd>{formatDuration(entry.totalTimeSeconds)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function RankingRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:border-[#f49700]/50 hover:shadow-md sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4 sm:gap-6">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-50 text-lg font-black text-slate-300">
            {entry.rank.toString().padStart(2, "0")}
          </span>
          <div className="min-w-0">
            <h3 className="break-words text-xl font-black text-[#0f1c2c]">{entry.displayName}</h3>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              {formatDuration(entry.totalTimeSeconds)}
            </p>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="text-2xl font-black text-[#0f1c2c]">{entry.score.toLocaleString()}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">points</p>
        </div>
      </div>
    </article>
  );
}

export function LeaderboardStandings({
  entries,
  format,
  actions,
  children,
  className,
}: LeaderboardStandingsProps) {
  const topEntries = entries.slice(0, 3);
  const remainingEntries = entries.slice(3);
  const label = entityLabel(format);

  return (
    <section className={cn("space-y-6", className)}>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f49700]">
            {format === "team" ? "Team leaderboard" : "Individual leaderboard"}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-normal text-[#0f1c2c]">
            Top standings
          </h2>
          <p className="mt-1 text-sm text-slate-500">{pluralEntityLabel(format, entries.length)}</p>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>

      {entries.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-500">No leaderboard entries yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topEntries.map((entry) => (
            <PodiumCard key={entry.id} entry={entry} />
          ))}

          {remainingEntries.length > 0 ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">
                  Full ranking
                </p>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-3">
                {remainingEntries.map((entry) => (
                  <RankingRow key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {children ? <div>{children}</div> : null}

      <p className="sr-only">
        {label} leaderboard sorted by rank, score, and total time.
      </p>
    </section>
  );
}
