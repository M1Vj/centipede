"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock3, UsersRound } from "lucide-react";
import type { TeamLiveMonitoringRow } from "@/components/monitoring/team-live-monitoring";
import { Badge } from "@/components/ui/badge";
import { ProgressLink } from "@/components/ui/progress-link";
import type { CompetitionRecord } from "@/lib/competition/types";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

type TeamLiveMonitoringPanelProps = {
  competition: CompetitionRecord;
  rows: TeamLiveMonitoringRow[];
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not seen";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not seen";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatScore(row: TeamLiveMonitoringRow) {
  const score = row.currentTotalScore.toLocaleString();
  return row.maxScore === null ? score : `${score} / ${row.maxScore.toLocaleString()}`;
}

function statusClass(status: TeamLiveMonitoringRow["status"]) {
  switch (status) {
    case "registered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "withdrawn":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "ineligible":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export function TeamLiveMonitoringPanel({ competition, rows }: TeamLiveMonitoringPanelProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registeredRows = rows.filter((row) => row.status === "registered");
  const totalScore = registeredRows.reduce((total, row) => total + row.currentTotalScore, 0);
  const activeTeams = registeredRows.filter((row) => row.activeAttemptCount > 0).length;
  const activeAttempts = rows.reduce((total, row) => total + row.activeAttemptCount, 0);

  useEffect(() => {
    const supabase = createBrowserClient();
    const refresh = () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = setTimeout(() => {
        router.refresh();
      }, 300);
    };
    const channel = supabase
      .channel(`organizer-live-teams-${competition.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_attempts", filter: `competition_id=eq.${competition.id}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_registrations", filter: `competition_id=eq.${competition.id}` },
        refresh,
      )
      .subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [competition.id, router]);

  return (
    <div className="space-y-6 font-['Poppins']">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgressLink
          href="/organizer/competition"
          className="text-sm font-bold text-slate-500 transition-colors hover:text-[#f49700]"
        >
          Back to Competitions
        </ProgressLink>
        <div className="flex flex-wrap gap-2">
          <ProgressLink
            href={`/organizer/competition/${competition.id}/participants`}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#10182b] shadow-sm transition hover:bg-slate-50"
          >
            Participant controls
          </ProgressLink>
          <ProgressLink
            href={`/organizer/competition/${competition.id}`}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-[#10182b] shadow-sm transition hover:bg-slate-50"
          >
            Competition setup
          </ProgressLink>
        </div>
      </div>

      <section className="border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                {competition.status}
              </Badge>
              <Badge variant="outline">Team</Badge>
              <Badge variant="outline" className="capitalize">
                {competition.type}
              </Badge>
            </div>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-[#10182b] md:text-3xl">
              {competition.name || "Team live monitoring"}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Team-focused live view with current total score aggregated from active and completed team attempts.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[480px]">
            <Metric label="Registered teams" value={registeredRows.length} />
            <Metric label="Teams active now" value={activeTeams} />
            <Metric label="Combined score" value={totalScore.toLocaleString()} />
          </div>
        </div>
      </section>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-2 border-b border-slate-100 px-5 py-4 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-lg font-black text-[#10182b]">Team score monitor</h2>
            <p className="mt-1 text-sm text-slate-500">
              Sorted by current total score. Realtime database changes refresh this page automatically.
            </p>
          </div>
          <Badge variant="outline">{activeAttempts} active attempts</Badge>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="No team registrations are available for live monitoring." />
        ) : (
          <div className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <article
                key={row.registrationId}
                className="grid gap-4 px-5 py-4 lg:grid-cols-[72px_minmax(0,1fr)_minmax(220px,0.45fr)] lg:items-center"
              >
                <div className="text-2xl font-black text-[#10182b]">#{index + 1}</div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <UsersRound className="size-4 text-slate-400" />
                    <h3 className="font-bold text-[#10182b]">{row.teamName}</h3>
                    <Badge variant="outline" className={statusClass(row.status)}>
                      {row.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>{row.rosterCount} members</span>
                    {row.subtitle ? <span>{row.subtitle}</span> : null}
                    <span>Last seen {formatDateTime(row.lastSeenAt)}</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden bg-slate-100" aria-label={`${row.progressPercent}% progress`}>
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${row.progressPercent}%` }}
                    />
                  </div>
                </div>
                <div className="grid gap-2 border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Current total score</p>
                  <p className="text-3xl font-black text-[#10182b]">{formatScore(row)}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    {row.activeAttemptCount} active, {row.finishedAttemptCount} finished
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-[#10182b]">{value}</p>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <Clock3 className="mb-4 size-10 text-slate-300" />
      <p className="font-bold text-slate-700">{title}</p>
    </div>
  );
}
