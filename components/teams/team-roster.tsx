"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Lock,
  LogOut,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, FormStatusMessage, LoadingState } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { TeamInviteForm } from "@/components/teams/team-invite-form";
import { TeamPendingInvites } from "@/components/teams/team-pending-invites";
import type { TeamDetailResponse, TeamRosterLock, TeamRosterMember } from "@/components/teams/types";
import { createIdempotencyToken, formatDate, getPayloadMessage, requestJson } from "@/components/teams/utils";
import { cn } from "@/lib/utils";

const defaultErrorMessage = "Unable to load team details.";
const defaultRosterLock: TeamRosterLock = {
  locked: false,
  competitionId: null,
  competitionName: null,
  competitionStartTime: null,
};

type TeamRosterProps = {
  teamId: string;
};

type ConfirmState =
  | { type: "leave" }
  | { type: "remove"; member: TeamRosterMember };

type MemberActionResponse = {
  code?: string;
  message?: string;
};

export function TeamRoster({ teamId }: TeamRosterProps) {
  const [teamName, setTeamName] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [teamCreatedAt, setTeamCreatedAt] = useState("");
  const [membershipRole, setMembershipRole] = useState("");
  const [membershipProfileId, setMembershipProfileId] = useState("");
  const [members, setMembers] = useState<TeamRosterMember[]>([]);
  const [rosterLock, setRosterLock] = useState<TeamRosterLock>(defaultRosterLock);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState(defaultErrorMessage);
  const [actionStatus, setActionStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [pendingAction, setPendingAction] = useState<ConfirmState | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [inviteRefreshKey, setInviteRefreshKey] = useState(0);
  const feedbackRouter = useFeedbackRouter();
  const { statusId, statusRef } = useFormStatusRegion(actionStatus.message);

  const isLeader = membershipRole === "leader";

  useEffect(() => {
    let isActive = true;

    const loadTeam = async () => {
      setStatus("loading");
      const response = await requestJson<TeamDetailResponse>(`/api/mathlete/teams/${teamId}`);

      if (!isActive) {
        return;
      }

      if (!response.ok || !response.payload) {
        setErrorMessage(response.message || defaultErrorMessage);
        setStatus("error");
        return;
      }

      const payload = response.payload;
      setTeamName(payload.team?.name ?? "");
      setTeamCode(payload.team?.teamCode ?? "");
      setTeamCreatedAt(payload.team?.createdAt ?? "");
      setMembershipRole(payload.membership?.role ?? "");
      setMembershipProfileId(payload.membership?.profileId ?? "");
      setMembers(payload.members ?? []);
      setRosterLock(payload.rosterLock ?? defaultRosterLock);
      setStatus("ready");
    };

    void loadTeam();

    return () => {
      isActive = false;
    };
  }, [teamId, refreshIndex]);

  const handleLeave = async () => {
    setPendingAction({ type: "leave" });
    setActionStatus({
      type: "pending",
      message: "Leaving team...",
    });

    try {
      const response = await requestJson<MemberActionResponse>(
        `/api/mathlete/teams/${teamId}/leave`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestIdempotencyToken: createIdempotencyToken(),
          }),
        },
      );

      if (!response.ok) {
        setActionStatus({
          type: "error",
          message: getPayloadMessage(response.payload, response.message || "Unable to leave team."),
        });
        return;
      }

      setActionStatus({
        type: "success",
        message: "You have left the team.",
      });
      feedbackRouter.push("/mathlete/teams");
    } catch {
      setActionStatus({
        type: "error",
        message: "Unable to leave the team right now.",
      });
    } finally {
      setPendingAction(null);
      setConfirmState(null);
    }
  };

  const handleRemove = async (member: TeamRosterMember) => {
    setPendingAction({ type: "remove", member });
    setActionStatus({
      type: "pending",
      message: "Removing member...",
    });

    try {
      const response = await requestJson<MemberActionResponse>(
        `/api/mathlete/teams/${teamId}/members/${member.profileId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestIdempotencyToken: createIdempotencyToken(),
          }),
        },
      );

      if (!response.ok) {
        setActionStatus({
          type: "error",
          message: getPayloadMessage(response.payload, response.message || "Unable to remove member."),
        });
        return;
      }

      setMembers((current) => current.filter((entry) => entry.profileId !== member.profileId));
      setActionStatus({
        type: "success",
        message: "Member removed from the roster.",
      });
    } catch {
      setActionStatus({
        type: "error",
        message: "Unable to remove member right now.",
      });
    } finally {
      setPendingAction(null);
      setConfirmState(null);
    }
  };

  if (status === "loading") {
    return (
      <LoadingState
        title="Loading team"
        description="Pulling team details and the current roster."
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Unable to load team"
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

  const seatCount = `${members.length}/5`;
  const competitionName = rosterLock.competitionName?.trim() || "Scheduled competition";
  const competitionDate = formatDate(rosterLock.competitionStartTime);
  const competitionDateBadge = formatRosterDate(rosterLock.competitionStartTime);
  const isRosterLocked = rosterLock.locked;

  return (
    <div className="mx-auto max-w-[1200px] space-y-8">
      <div className="space-y-5">
        <ProgressLink
          href="/mathlete/teams"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.35)] transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          Back to teams
        </ProgressLink>

        <div className="rounded-[1.9rem] border border-slate-200 bg-white p-6 shadow-[0_24px_56px_-42px_rgba(15,23,42,0.22)] md:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#f49700]">
                {isLeader ? "Manage Team" : "Team Details"}
              </p>
              <h1 className="font-display text-3xl font-black tracking-[-0.05em] text-[#1a1e2e] md:text-4xl">
                {teamName || "Team"}
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-500">
                {isLeader
                  ? "Manage your members and invites from one cleaner team view."
                  : "Review your roster and stay updated with your team in one cleaner view."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="min-w-[140px] rounded-[1.25rem] bg-slate-50 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Members</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#1a1e2e]">{seatCount}</p>
              </div>
              <div className="min-w-[140px] rounded-[1.25rem] bg-slate-50 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Role</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-[#1a1e2e]">
                  {membershipRole ? membershipRole[0]?.toUpperCase() + membershipRole.slice(1) : "Member"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={actionStatus.type}
            message={actionStatus.message}
            icon={actionStatus.type === "error" ? CircleAlert : actionStatus.type === "success" ? CheckCircle2 : undefined}
          />
        </div>

        <div className="rounded-[1.9rem] bg-[#1a1e2e] p-6 text-white shadow-[0_28px_60px_-42px_rgba(26,30,46,0.9)] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.25rem] bg-[#f49700] text-white shadow-[0_12px_28px_-12px_rgba(244,151,0,0.65)]">
                {isRosterLocked ? <Lock className="size-6" strokeWidth={2.4} /> : <Sparkles className="size-6" strokeWidth={2.4} />}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black tracking-[-0.03em] text-white md:text-2xl">
                  {isRosterLocked
                    ? `Roster locked - team is registered for ${competitionName}.`
                    : isLeader
                      ? "Roster open - invite and shape your strongest lineup."
                      : "Roster active - stay ready for the next challenge."}
                </h2>
                <p className="text-sm leading-7 text-slate-300">
                  {isRosterLocked
                    ? "Changes to the team structure are disabled during the active competition window."
                    : isLeader
                      ? "Leader actions remain available until the team enters an active registered competition window."
                      : `Team created ${formatDate(teamCreatedAt)}. Your leader can still adjust the roster while no active lock is in place.`}
                </p>
              </div>
            </div>

            <div className="flex min-w-[132px] flex-col items-center justify-center rounded-[1.25rem] border border-white/10 bg-white/[0.06] px-5 py-4 text-center">
              <span className="text-2xl font-black leading-none text-[#f49700]">{competitionDateBadge}</span>
              <span className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                {isRosterLocked ? "Competition Date" : "Roster Status"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={cn("grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]")}>
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[12px] font-black uppercase tracking-[0.18em] text-[#1a1e2e]">
              Team Members - {seatCount}
            </h2>
            <div className="h-[2px] w-12 rounded-full bg-[#f49700]" />
          </div>

          <div className="space-y-4">
            {members.length === 0 ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-[0_22px_48px_-40px_rgba(15,23,42,0.35)]">
                Invite teammates to start building your roster.
              </div>
            ) : (
              members.map((member) => {
                const name = member.profile?.fullName?.trim() || "Mathlete";
                const details = [member.profile?.school, member.profile?.gradeLevel]
                  .filter(Boolean)
                  .join(" | ");
                const isSelf = member.profileId === membershipProfileId;
                const canRemove = isLeader && !isSelf;
                const initials = name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
                  .toUpperCase();

                return (
                  <div
                    key={member.id}
                    className={cn(
                      "relative overflow-hidden rounded-[1.6rem] border p-5 shadow-[0_20px_44px_-38px_rgba(15,23,42,0.35)] transition-colors sm:p-6",
                      member.role === "leader"
                        ? "border-[#1a1e2e] bg-[#1a1e2e] text-white"
                        : "border-slate-200 bg-white",
                      isSelf && member.role !== "leader" ? "border-[#f49700]/30" : undefined,
                    )}
                  >
                    {isSelf && member.role !== "leader" ? (
                      <div className="absolute inset-y-0 left-0 w-1 bg-[#f49700]" />
                    ) : null}

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            "flex h-12 w-12 items-center justify-center rounded-full text-xs font-bold",
                            member.role === "leader"
                              ? "border-2 border-[#f49700] bg-[#111827] text-white"
                              : "bg-[#1a1e2e] text-white",
                          )}
                        >
                          {initials || "M"}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className={cn("text-lg font-black tracking-[-0.02em]", member.role === "leader" ? "text-white" : "text-[#1a1e2e]")}>
                              {name}
                            </p>
                            {isSelf ? (
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]",
                                  member.role === "leader"
                                    ? "border-white/10 bg-white/10 text-slate-200"
                                    : "border-[#f49700]/20 bg-[#fff5e5] text-[#d67b00]",
                                )}
                              >
                                You
                              </span>
                            ) : null}
                          </div>
                          <p className={cn("text-sm", member.role === "leader" ? "text-slate-300" : "text-slate-500")}>
                            Joined {formatDate(member.joinedAt)}
                            {details ? ` | ${details}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={cn(
                            "rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.14em]",
                            member.role === "leader"
                              ? "bg-[#f49700] text-[#1a1e2e] shadow-[0_10px_24px_-18px_rgba(244,151,0,0.8)]"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {member.role === "leader" ? "Team Leader" : "Member"}
                        </span>
                        {canRemove ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-11 w-11 rounded-full border border-rose-100 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:text-rose-600"
                            onClick={() => setConfirmState({ type: "remove", member })}
                            disabled={Boolean(pendingAction) || isRosterLocked}
                            aria-label={`Remove ${name}`}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {isLeader ? (
            <TeamInviteForm
              teamId={teamId}
              rosterLocked={isRosterLocked}
              onInviteSent={() => setInviteRefreshKey((value) => value + 1)}
            />
          ) : null}
        </section>

        <aside className="space-y-6">
          <div className="relative overflow-hidden rounded-[1.9rem] bg-[#f49700] p-7 text-white shadow-[0_30px_64px_-42px_rgba(244,151,0,0.55)]">
            <div className="pointer-events-none absolute -bottom-10 -right-10 h-36 w-36 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -right-6 top-8 h-16 w-16 rotate-12 rounded-3xl border border-white/20" />
            <div className="relative space-y-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/80">Team Code</p>
              <div className="rounded-[1.15rem] border border-white/30 bg-white/[0.18] px-5 py-4 backdrop-blur-sm">
                <p className="break-all text-center font-mono text-2xl font-bold tracking-[0.2em] text-white">
                  {teamCode || "Unavailable"}
                </p>
              </div>
              <p className="text-sm leading-7 text-white/90">
                Share this code with mathletes you want to bring into {teamName || "the team"}.
              </p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[1.9rem] bg-[#1a1e2e] p-7 text-white shadow-[0_32px_64px_-40px_rgba(26,30,46,0.92)]">
            <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-[#f49700]/12 blur-[48px]" />
            <div className="relative space-y-5">
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-2 rounded-full bg-[#f49700] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#1a1e2e]">
                  {isRosterLocked ? "Locked" : "Upcoming"}
                </span>
                <span className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  {isRosterLocked ? "Registered" : "Ready"}
                </span>
              </div>

              <div className="space-y-3">
                <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-white/45">
                  <CalendarDays className="size-3.5" />
                  Competition Snapshot
                </p>
                <h3 className="font-display text-[1.65rem] font-black leading-tight tracking-[-0.04em] text-white">
                  {isRosterLocked ? competitionName : "Competition sync pending"}
                </h3>
                <p className="text-sm leading-7 text-slate-300">
                  {isRosterLocked
                    ? `Roster changes are paused until ${competitionDate}.`
                    : "The current team endpoint still does not expose the next competition payload, so this panel keeps the approved design structure with placeholder copy."}
                </p>
              </div>
            </div>
          </div>

          {isLeader ? (
            <TeamPendingInvites
              teamId={teamId}
              rosterLocked={isRosterLocked}
              refreshToken={inviteRefreshKey}
            />
          ) : null}

          <div className="space-y-3 rounded-[1.6rem] border border-rose-200 bg-[#fff7f7] p-4 shadow-[0_22px_48px_-40px_rgba(15,23,42,0.35)]">
            <p className="text-sm text-slate-500">
              {isRosterLocked
                ? "Leaving is disabled while your team is locked into an active registered competition."
                : "You will lose access until the leader invites you again."}
            </p>
            <Button
              type="button"
              variant="ghost"
              className="flex h-12 w-full items-center justify-between rounded-[1rem] border border-rose-200 bg-white px-4 text-sm font-bold text-rose-500 shadow-sm hover:bg-rose-50 hover:text-rose-600"
              onClick={() => setConfirmState({ type: "leave" })}
              disabled={Boolean(pendingAction) || isRosterLocked}
            >
              Leave team
              <LogOut className="size-5" />
            </Button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open && !pendingAction) {
            setConfirmState(null);
          }
        }}
        title={
          confirmState?.type === "remove"
            ? "Remove team member?"
            : "Leave team?"
        }
        description={
          confirmState?.type === "remove"
            ? "This member will be removed from the active roster immediately."
            : "You will lose access to this team until another leader invites you."
        }
        confirmLabel={confirmState?.type === "remove" ? "Remove member" : "Leave team"}
        pending={Boolean(pendingAction)}
        pendingLabel={confirmState?.type === "remove" ? "Removing..." : "Leaving..."}
        onConfirm={() => {
          if (confirmState?.type === "remove") {
            void handleRemove(confirmState.member);
            return;
          }

          void handleLeave();
        }}
      />
    </div>
  );
}

function formatRosterDate(value?: string | null) {
  if (!value) {
    return "OPEN";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
  }).format(date).toUpperCase();
}
