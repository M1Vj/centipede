"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState, FormStatusMessage, LoadingState } from "@/components/ui/feedback-states";
import { ProgressLink } from "@/components/ui/progress-link";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { TeamInviteForm } from "@/components/teams/team-invite-form";
import { TeamPendingInvites } from "@/components/teams/team-pending-invites";
import type { TeamDetailResponse, TeamRosterMember } from "@/components/teams/types";
import { createIdempotencyToken, formatDate, getPayloadMessage, requestJson } from "@/components/teams/utils";

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

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{teamName || "Team"}</CardTitle>
          <CardDescription>Manage your roster, invites, and team access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border/60 bg-background/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Team code
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">{teamCode || "Unavailable"}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your role
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {membershipRole ? membershipRole[0]?.toUpperCase() + membershipRole.slice(1) : "Member"}
              </p>
            </div>
          </div>

          <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
            <FormStatusMessage
              status={actionStatus.type}
              message={actionStatus.message}
              icon={actionStatus.type === "error" ? CircleAlert : actionStatus.type === "success" ? CheckCircle2 : undefined}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline">
              <ProgressLink href="/mathlete/teams">Back to teams</ProgressLink>
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmState({ type: "leave" })}
              disabled={Boolean(pendingAction)}
            >
              Leave team
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLeader ? (
        <div className="space-y-6">
          <TeamInviteForm teamId={teamId} />
          <TeamPendingInvites teamId={teamId} />
        </div>
      ) : null}

      <Card className="border-border/60 bg-background/90 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Roster</CardTitle>
          <CardDescription>Active members currently attached to this team.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.length === 0 ? (
            <div className="rounded-xl border border-border/60 bg-background/80 p-4 text-sm text-muted-foreground">
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

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 rounded-xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{name}</p>
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDate(member.joinedAt)}
                      {details ? ` | ${details}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={member.role === "leader" ? "default" : "secondary"}>
                      {member.role === "leader" ? "Leader" : "Member"}
                    </Badge>
                    {isSelf ? <Badge variant="outline">You</Badge> : null}
                    {canRemove ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
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
        </CardContent>
      </Card>

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
