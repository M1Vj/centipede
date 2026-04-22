"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  CirclePlus,
  KeyRound,
  Sparkles,
  UsersRound,
} from "lucide-react";
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
        action={(
          <Button
            type="button"
            variant="outline"
            onClick={() => setRefreshIndex((value) => value + 1)}
          >
            Try again
          </Button>
        )}
      />
    );
  }

  if (teams.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-[2.5rem] px-1 pb-4 pt-2">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-12 mx-auto h-[26rem] w-[26rem] rounded-full bg-white blur-[120px] opacity-80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-[12rem] rounded-full bg-[#f49700]/14 blur-3xl"
        />

        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-8">
            <div className="flex h-[110px] w-[110px] items-center justify-center rounded-[32px] border border-slate-100 bg-white shadow-[0_18px_42px_-28px_rgba(15,23,42,0.22)]">
              <UsersRound className="size-12 text-[#f49700]" strokeWidth={2.4} />
            </div>
            <div className="absolute -bottom-3 -right-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1e2e] text-white shadow-xl">
              <Sparkles className="size-6" />
            </div>
          </div>

          <div className="max-w-3xl space-y-5">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#f49700]">
              Collaboration Is Power
            </p>
            <div className="space-y-2">
              <h2 className="text-5xl font-black leading-[0.98] tracking-[-0.07em] text-[#1a1e2e] md:text-7xl">
                <span className="block">Great Minds</span>
                <span className="block text-[#f49700]">Think Together.</span>
              </h2>
              <p className="mx-auto max-w-2xl text-sm leading-7 text-slate-500 md:text-lg">
                You have not joined any teams yet. Build a sharp squad, claim your team code,
                and get your roster competition-ready before the next bracket opens.
              </p>
            </div>
          </div>
        </div>

        <div className="relative mt-14 grid gap-6 lg:grid-cols-2">
          <article className="group flex flex-col rounded-[2rem] border border-slate-100 bg-white p-8 text-center shadow-[0_24px_56px_-34px_rgba(15,23,42,0.18)] transition-transform duration-300 hover:-translate-y-1">
            <div className="mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-[#fef5e6] text-[#f49700]">
              <CirclePlus className="size-7" />
            </div>
            <div className="mt-6 space-y-3">
              <h3 className="text-[1.75rem] font-black tracking-[-0.05em] text-[#1a1e2e]">
                Start Your Team
              </h3>
              <p className="mx-auto max-w-sm text-sm leading-7 text-slate-500">
                Lead your own lineup, unlock your invite code, and shape the chemistry of a
                focused mathlete squad.
              </p>
            </div>
            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              <div className="rounded-[1.4rem] border border-slate-100 bg-[#faf7f2] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Capacity
                </p>
                <p className="mt-2 text-base font-semibold text-[#13233b]">Up to 5 members</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-[#faf7f2] p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Leader Tools
                </p>
                <p className="mt-2 text-base font-semibold text-[#13233b]">Invite and manage</p>
              </div>
            </div>
            <Button asChild className="mt-8 h-12 rounded-xl bg-[#f49700] text-sm font-bold text-[#1a1e2e] shadow-[0_14px_30px_-18px_rgba(244,151,0,0.8)] hover:bg-[#e68b00] hover:text-[#1a1e2e]">
              <ProgressLink href="/mathlete/teams/create">Create Team</ProgressLink>
            </Button>
          </article>

          <article className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#1a1e2e] p-8 text-center text-white shadow-[0_30px_64px_-36px_rgba(16,24,43,0.82)] transition-transform duration-300 hover:-translate-y-1">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-white/6 blur-[56px]"
            />
            <div className="relative mx-auto flex h-[60px] w-[60px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white">
              <KeyRound className="size-7" />
            </div>
            <div className="relative mt-6 space-y-3">
              <h3 className="text-[1.75rem] font-black tracking-[-0.05em] text-white">
                Join Existing Team
              </h3>
              <p className="mx-auto max-w-sm text-sm leading-7 text-white/68">
                Already holding a code from your leader? Jump straight into the squad and get
                synced with the rest of the roster.
              </p>
            </div>
            <div className="relative mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5 text-left">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/42">
                Join Flow
              </p>
              <p className="mt-3 text-lg font-semibold text-white">Enter team code and verify access</p>
              <p className="mt-2 text-sm leading-7 text-white/58">
                Pending invites remain separate, so direct code entry stays clean and fast.
              </p>
            </div>
            <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild className="h-12 flex-1 rounded-xl bg-[#f49700] text-sm font-bold text-[#1a1e2e] hover:bg-[#e68b00] hover:text-[#1a1e2e]">
                <ProgressLink href="/mathlete/teams/join">Join via code</ProgressLink>
              </Button>
              <Button asChild variant="ghost" className="h-12 flex-1 rounded-xl text-sm font-semibold text-white hover:bg-white/8 hover:text-white">
                <ProgressLink href="/mathlete/teams/invites">Review Invites</ProgressLink>
              </Button>
            </div>
          </article>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const isLeader = team.membership?.isLeader;

          return (
            <article
              key={team.id}
              className={cn(
                "group relative flex min-h-[220px] flex-col overflow-hidden rounded-[1.75rem] border p-6 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.28)] transition-transform duration-300 hover:-translate-y-1",
                isLeader
                  ? "border-[#f49700]/20 bg-[linear-gradient(180deg,#fff8ee_0%,#ffffff_60%)]"
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
                  <div className="space-y-1.5">
                    <h2 className="text-[1.55rem] font-black tracking-[-0.05em] text-[#10182b]">
                      {team.name}
                    </h2>
                    <p className="text-sm font-medium text-slate-500">
                      Joined {formatDate(team.membership?.joinedAt)}
                    </p>
                    <p className="pt-1 text-sm leading-6 text-slate-500">
                      {isLeader
                        ? "You can manage the roster and team invites."
                        : "You are synced as a team member in this roster."}
                    </p>
                  </div>
                  <Badge
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      isLeader
                        ? "border-[#f49700]/20 bg-[#f49700] text-white hover:bg-[#f49700]"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {isLeader ? "Leader" : "Member"}
                  </Badge>
                </div>

                <div className="mt-auto pt-6">
                  <Button asChild className="h-11 w-full rounded-full bg-[#10182b] px-5 text-sm font-semibold text-white hover:bg-[#1b2742]">
                    <ProgressLink href={`/mathlete/teams/${team.id}`} className="inline-flex items-center gap-2">
                      {isLeader ? "Manage team" : "View team"}
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
          className="flex min-h-[220px] flex-col justify-between rounded-[1.75rem] border-2 border-dashed border-slate-300 bg-white/55 p-6 transition hover:border-[#f49700]/40 hover:bg-white"
        >
          <div className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-slate-100 text-slate-600">
              <CirclePlus className="size-5" />
            </div>
            <div className="space-y-2">
              <p className="text-[1.45rem] font-black tracking-[-0.05em] text-[#10182b]">
                Add another team
              </p>
              <p className="text-sm leading-7 text-slate-500">
                Expand your network and spin up another roster without leaving the workspace.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#f49700]">
            Create new team
            <ArrowRight className="size-4" />
          </span>
        </ProgressLink>
    </div>
  );
}
