"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, CircleAlert, Crown, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, FormStatusMessage, LoadingState } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { TeamInviteForm } from "@/components/teams/team-invite-form";
import { TeamPendingInvites } from "@/components/teams/team-pending-invites";
import type { TeamDetailResponse, TeamRosterMember } from "@/components/teams/types";
import { createIdempotencyToken, formatDate, getPayloadMessage, requestJson } from "@/components/teams/utils";
import { cn } from "@/lib/utils";

const defaultErrorMessage = "Unable to load team details.";

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

  const leader = members.find((member) => member.role === "leader");
  const leaderName = leader?.profile?.fullName?.trim() || "Team leader";
  const seatCount = `${members.length}/5`;

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        <ProgressLink
          href="/mathlete/teams"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.35)] transition hover:bg-slate-50 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" />
          Back to teams
        </ProgressLink>

        <div className="rounded-[2.25rem] bg-[#10182b] p-6 text-white shadow-[0_36px_72px_-42px_rgba(16,24,43,0.88)] md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <Badge className="rounded-full border-white/10 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white hover:bg-white/10">
                {isLeader ? "Leader controls" : "Member access"}
              </Badge>
              <div className="space-y-3">
                <h1 className="font-display text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                  {teamName || "Team"}
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-white/66 md:text-base">
                  Manage roster, invites, and access from one mathlete team workspace.
                </p>
              </div>
            </div>

            <div className="grid min-w-[250px] gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/42">Seats Filled</p>
                <p className="mt-2 text-2xl font-semibold text-white">{seatCount}</p>
                <p className="mt-1 text-sm text-white/58">Active members in roster.</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/6 p-4">
                <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/42">
                  <Shield className="size-3.5" />
                  Your Role
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {membershipRole ? membershipRole[0]?.toUpperCase() + membershipRole.slice(1) : "Member"}
                </p>
                <p className="mt-1 text-sm text-white/58">Leader can invite and remove members.</p>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/42">Team Code</p>
              <p className="mt-3 font-mono text-2xl font-semibold tracking-[0.22em] text-white">
                {teamCode || "Unavailable"}
              </p>
              <p className="mt-2 text-sm text-white/56">Share code with mathletes who should join this roster.</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/10 bg-white/6 p-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/42">Team Lead</p>
              <p className="mt-3 text-xl font-semibold text-white">{leaderName}</p>
              <p className="mt-2 text-sm text-white/56">
                Created {formatDate(teamCreatedAt)}. Competition sync data not exposed yet, so upcoming panel uses placeholder state.
              </p>
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
      </div>

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]")}>
        <section className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-[0_28px_64px_-48px_rgba(15,23,42,0.35)] sm:p-6">
          <div className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-[-0.03em] text-[#13233b]">Roster</h2>
              <p className="text-sm leading-7 text-slate-500">Active members currently attached to this team.</p>
            </div>
            <Badge variant="outline" className="rounded-full border-[#f49700]/20 bg-[#fff5e5] px-3 py-1 text-[#d67b00]">
              {members.length} active
            </Badge>
          </div>
          <div className="mt-5 space-y-4">
            {members.length === 0 ? (
              <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-500">
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
                      "flex flex-col gap-4 rounded-[1.6rem] border p-4 sm:flex-row sm:items-center sm:justify-between",
                      member.role === "leader"
                        ? "border-[#f49700]/20 bg-[#fff8ed]"
                        : "border-slate-200/80 bg-slate-50/70",
                      isSelf ? "ring-1 ring-chart-4/35" : undefined,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex h-12 w-12 items-center justify-center rounded-full text-xs font-semibold",
                          member.role === "leader"
                            ? "bg-[#f49700] text-white"
                            : "bg-[#10182b] text-white",
                        )}
                      >
                        {initials || "M"}
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-[#13233b]">{name}</p>
                        <p className="text-xs text-slate-500">
                          Joined {formatDate(member.joinedAt)}
                          {details ? ` | ${details}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        member.role === "leader"
                          ? "bg-[#f49700] text-white hover:bg-[#f49700]"
                          : "bg-slate-200 text-slate-700 hover:bg-slate-200",
                      )}>
                        {member.role === "leader" ? "Leader" : "Member"}
                      </Badge>
                      {isSelf ? <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 text-slate-500">You</Badge> : null}
                      {canRemove ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-full"
                          onClick={() => setConfirmState({ type: "remove", member })}
                          disabled={Boolean(pendingAction)}
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-[2rem] border border-[#f49700]/20 bg-[#fff8ed] p-5 shadow-[0_24px_60px_-44px_rgba(244,151,0,0.35)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#d67b00]">Roster Access</p>
                <p className="text-2xl font-semibold tracking-[-0.03em] text-[#13233b]">{teamCode || "Unavailable"}</p>
              </div>
              <Crown className="size-5 text-[#f49700]" />
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Share code only with intended members. Existing API gives no lock state, so code panel stays always visible to current members.
            </p>
          </div>

          <div className="rounded-[2rem] bg-[#10182b] p-5 text-white shadow-[0_30px_64px_-40px_rgba(16,24,43,0.9)]">
            <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white/46">
              <CalendarDays className="size-3.5" />
              Upcoming Challenge
            </p>
            <p className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-white">Competition data pending</p>
            <p className="mt-3 text-sm leading-7 text-white/62">
              Figma shows locked/upcoming team competition card. Current mathlete team endpoint does not expose next event payload yet.
            </p>
          </div>

          {isLeader ? (
            <>
              <TeamInviteForm teamId={teamId} />
              <TeamPendingInvites teamId={teamId} />
            </>
          ) : null}

          <div className="rounded-[2rem] border border-rose-200 bg-white p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)]">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-rose-500">Danger Zone</p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#13233b]">Leave team</p>
            <p className="mt-2 text-sm leading-7 text-slate-500">
              You lose access until leader invites you again.
            </p>
            <Button
              type="button"
              variant="destructive"
              className="mt-5 rounded-full"
              onClick={() => setConfirmState({ type: "leave" })}
              disabled={Boolean(pendingAction)}
            >
              Leave team
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
