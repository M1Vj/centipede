"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CirclePlus, KeyRound, Shield, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { formatDate, requestJson } from "@/components/teams/utils";
import type { TeamListEntry, TeamListResponse } from "@/components/teams/types";
import { cn } from "@/lib/utils";

export function TeamList() {
  const [teams, setTeams] = useState<TeamListEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState("Unable to load teams.");
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    let isActive = true;

    const loadTeams = async () => {
      setStatus("loading");
      const result = await requestJson<TeamListResponse>("/api/mathlete/teams");

      if (!isActive) {
        return;
      }

      if (!result.ok || !result.payload) {
        setErrorMessage(result.message || "Unable to load teams.");
        setStatus("error");
        return;
      }

      setTeams(result.payload.teams ?? []);
      setStatus("ready");
    };

    void loadTeams();

    return () => {
      isActive = false;
    };
  }, [refreshIndex]);

  if (status === "loading") {
    return (
      <LoadingState
        title="Loading teams"
        description="Fetching your team roster and membership details."
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Unable to load teams"
        description={errorMessage}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => setRefreshIndex((value) => value + 1)}
          >
            Try again
          </Button>
        }
      />
    );
  }

  const leaderCount = teams.filter((team) => team.membership?.isLeader).length;

  if (teams.length === 0) {
    return (
      <div className="space-y-8">
        <div className="max-w-2xl space-y-4">
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[#f49700]">
            Team Lobby
          </p>
          <h2 className="font-display text-4xl font-semibold tracking-[-0.04em] text-[#10182b] md:text-5xl">
            No squads yet. Build first roster.
          </h2>
          <p className="text-sm leading-7 text-slate-500 md:text-base">
            Form team of elite mathletes, invite members fast, and keep lineup ready before next competition drop.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-[2rem] bg-[#10182b] p-6 text-white shadow-[0_36px_72px_-42px_rgba(16,24,43,0.85)] md:p-8">
            <div className="space-y-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-white/10 text-[#f49700]">
                <CirclePlus className="size-6" />
              </div>
              <div className="space-y-2">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-white">Create team</p>
                <p className="max-w-md text-sm leading-7 text-white/68">
                  Start private squad, own team code, and manage invites from one place.
                </p>
              </div>
              <div className="grid gap-3 pt-2 text-sm text-white/78 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/48">Roster Size</p>
                  <p className="mt-2 text-lg font-semibold text-white">Up to 5 mathletes</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-white/48">Leader Tools</p>
                  <p className="mt-2 text-lg font-semibold text-white">Invite, remove, review</p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-12 rounded-full bg-[#f49700] px-6 text-sm font-bold text-white hover:bg-[#e68b00]">
                <ProgressLink href="/mathlete/teams/create">Create Team</ProgressLink>
              </Button>
              <Button asChild variant="ghost" className="h-12 rounded-full px-5 text-white hover:bg-white/8 hover:text-white">
                <ProgressLink href="/mathlete/teams/invites">Review Invites</ProgressLink>
              </Button>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-[#f49700]/10 text-[#f49700]">
                <KeyRound className="size-5" />
              </div>
              <div className="mt-5 space-y-2">
                <p className="text-2xl font-semibold tracking-[-0.03em] text-[#10182b]">Join with code</p>
                <p className="text-sm leading-7 text-slate-500">
                  Already got invite code from leader? Jump straight into squad join flow.
                </p>
              </div>
              <Button asChild variant="outline" className="mt-6 h-12 rounded-full border-slate-200 bg-white px-6 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800">
                <ProgressLink href="/mathlete/teams/join">Join via code</ProgressLink>
              </Button>
            </div>

            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Need decision later?</p>
              <p className="mt-3 text-lg font-semibold tracking-[-0.03em] text-[#13233b]">
                Pending invites live in separate inbox.
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
                Keep accepts and declines clean instead of mixing them into create flow.
              </p>
              <ProgressLink href="/mathlete/teams/invites" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#f49700]">
                Open invite inbox
                <ArrowRight className="size-4" />
              </ProgressLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_22px_56px_-44px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Total Teams</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#10182b]">{teams.length}</p>
          <p className="mt-2 text-sm text-slate-500">Active squads tied to your mathlete account.</p>
        </div>
        <div className="rounded-[1.75rem] border border-white/80 bg-white p-5 shadow-[0_22px_56px_-44px_rgba(15,23,42,0.35)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">Leader Seats</p>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#10182b]">{leaderCount}</p>
          <p className="mt-2 text-sm text-slate-500">Teams where you control roster and invites.</p>
        </div>
        <div className="rounded-[1.75rem] bg-[#10182b] p-5 text-white shadow-[0_30px_64px_-40px_rgba(16,24,43,0.9)]">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-white/46">Team Inbox</p>
          <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">Need pending invite check?</p>
          <ProgressLink href="/mathlete/teams/invites" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#f49700]">
            Open inbox
            <ArrowRight className="size-4" />
          </ProgressLink>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const isLeader = team.membership?.isLeader;

          return (
            <article
              key={team.id}
              className={cn(
                "group relative flex min-h-[260px] flex-col overflow-hidden rounded-[2rem] border p-6 shadow-[0_28px_64px_-48px_rgba(15,23,42,0.35)] transition-transform hover:-translate-y-1",
                isLeader
                  ? "border-[#f49700]/20 bg-[linear-gradient(180deg,#fff8ed_0%,#ffffff_46%)]"
                  : "border-white/80 bg-white",
              )}
            >
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full blur-3xl",
                  isLeader ? "bg-[#f49700]/16" : "bg-[#10182b]/6",
                )}
              />

              <div className="relative flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-3">
                    <div className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-[1.15rem]",
                      isLeader ? "bg-[#f49700] text-white" : "bg-slate-100 text-slate-700",
                    )}>
                      {isLeader ? <Shield className="size-5" /> : <Users className="size-5" />}
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[#10182b]">{team.name}</h2>
                      <p className="text-sm text-slate-500">Joined {formatDate(team.membership?.joinedAt)}</p>
                    </div>
                  </div>
                  <Badge className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    isLeader
                      ? "border-[#f49700]/20 bg-[#f49700] text-white hover:bg-[#f49700]"
                      : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50",
                  )}>
                    {isLeader ? "Leader" : "Member"}
                  </Badge>
                </div>

                <div className="mt-8 grid gap-3 text-sm">
                  <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Team Code</p>
                    <p className="mt-2 font-mono text-sm font-semibold tracking-[0.18em] text-[#13233b]">{team.teamCode}</p>
                  </div>
                  <div className="rounded-[1.35rem] border border-slate-200/80 bg-white/80 p-4">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Access</p>
                    <p className="mt-2 text-sm font-medium text-slate-600">
                      {isLeader ? "Invite members and manage roster." : "View roster and stay synced with team."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  {isLeader ? (
                    <div className="inline-flex items-center gap-2 text-xs font-medium text-[#d67b00]">
                      <Sparkles className="size-3.5" />
                      Leader controls live
                    </div>
                  ) : <span className="text-xs font-medium text-slate-400">Workspace linked</span>}

                  <Button asChild className="h-11 rounded-full bg-[#10182b] px-5 text-sm font-semibold text-white hover:bg-[#1b2742]">
                    <ProgressLink href={`/mathlete/teams/${team.id}`} className="inline-flex items-center gap-2">
                      View team
                      <ArrowRight className="size-4" />
                    </ProgressLink>
                  </Button>
                </div>
              </div>
            </article>
          );
        })}

        <ProgressLink
          href="/mathlete/teams/create"
          className="flex min-h-[260px] flex-col justify-between rounded-[2rem] border border-dashed border-slate-300 bg-white/55 p-6 transition hover:border-[#f49700]/40 hover:bg-white"
        >
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-slate-100 text-slate-600">
              <CirclePlus className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-semibold tracking-[-0.04em] text-[#10182b]">Add team</p>
              <p className="text-sm leading-7 text-slate-500">
                Start another squad without leaving current workspace.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#f49700]">
            Create new team
            <ArrowRight className="size-4" />
          </span>
        </ProgressLink>
      </div>
    </div>
  );
}
