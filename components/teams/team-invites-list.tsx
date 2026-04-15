"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, FormStatusMessage, LoadingState } from "@/components/ui/feedback-states";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { createIdempotencyToken, formatDate, getPayloadMessage, requestJson } from "@/components/teams/utils";
import type { TeamInvite, TeamInvitesResponse } from "@/components/teams/types";

const defaultErrorMessage = "Unable to load invites.";

type InviteActionResponse = {
  code?: string;
  invite?: {
    teamId?: string;
  };
  message?: string;
};

export function TeamInvitesList() {
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState(defaultErrorMessage);
  const [actionStatus, setActionStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const [pendingAction, setPendingAction] = useState<{
    inviteId: string;
    action: "accept" | "decline";
  } | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const feedbackRouter = useFeedbackRouter();
  const { statusId, statusRef } = useFormStatusRegion(actionStatus.message);

  useEffect(() => {
    let isActive = true;

    const loadInvites = async () => {
      setStatus("loading");
      const response = await requestJson<TeamInvitesResponse>("/api/mathlete/teams/invites");

      if (!isActive) {
        return;
      }

      if (!response.ok || !response.payload) {
        setErrorMessage(response.message || defaultErrorMessage);
        setStatus("error");
        return;
      }

      setInvites(response.payload.invites ?? []);
      setStatus("ready");
    };

    void loadInvites();

    return () => {
      isActive = false;
    };
  }, [refreshIndex]);

  const handleInviteAction = async (
    inviteId: string,
    action: "accept" | "decline",
  ) => {
    if (pendingAction) {
      return;
    }

    setPendingAction({ inviteId, action });
    setActionStatus({
      type: "pending",
      message: action === "accept" ? "Accepting invite..." : "Declining invite...",
    });

    try {
      const response = await requestJson<InviteActionResponse>(
        `/api/mathlete/teams/invites/${inviteId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            requestIdempotencyToken: createIdempotencyToken(),
          }),
        },
      );

      if (!response.ok) {
        setActionStatus({
          type: "error",
          message: getPayloadMessage(response.payload, response.message || "Invite update failed."),
        });
        return;
      }

      const teamId = response.payload?.invite?.teamId ?? invites.find((invite) => invite.id === inviteId)?.teamId;
      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      setActionStatus({
        type: "success",
        message: action === "accept" ? "Invite accepted." : "Invite declined.",
      });

      if (action === "accept" && teamId) {
        feedbackRouter.push(`/mathlete/teams/${teamId}`);
        return;
      }
    } catch {
      setActionStatus({
        type: "error",
        message: "Invite update failed. Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (status === "loading") {
    return (
      <LoadingState
        title="Loading invites"
        description="Checking for pending team invitations."
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Unable to load invites"
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

  if (invites.length === 0) {
    return (
      <EmptyState
        title="No invites yet"
        description="Team invitations will appear here as soon as someone invites you."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
        <FormStatusMessage
          status={actionStatus.type}
          message={actionStatus.message}
          icon={actionStatus.type === "error" ? CircleAlert : actionStatus.type === "success" ? CheckCircle2 : undefined}
        />
      </div>

      <div className="grid gap-6">
        {invites.map((invite) => {
          const inviterName = invite.inviter?.fullName?.trim() || "Mathlete";
          const inviterDetails = [invite.inviter?.school, invite.inviter?.gradeLevel]
            .filter(Boolean)
            .join(" | ");
          const teamName = invite.team?.name ?? "Team invitation";
          const teamCode = invite.team?.teamCode ?? null;
          const isPending = pendingAction?.inviteId === invite.id;
          const isAccepting = isPending && pendingAction?.action === "accept";
          const isDeclining = isPending && pendingAction?.action === "decline";

          return (
            <Card key={invite.id} className="border-border/60 bg-background/90 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="space-y-2">
                  <div className="text-lg font-semibold text-foreground">{teamName}</div>
                  <p className="text-sm text-muted-foreground">
                    Invited by {inviterName}
                    {inviterDetails ? ` (${inviterDetails})` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Sent {formatDate(invite.createdAt)}
                    {teamCode ? ` | Code ${teamCode}` : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => void handleInviteAction(invite.id, "accept")}
                    pending={isAccepting}
                    pendingText="Accepting..."
                    disabled={Boolean(pendingAction)}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleInviteAction(invite.id, "decline")}
                    pending={isDeclining}
                    pendingText="Declining..."
                    disabled={Boolean(pendingAction)}
                  >
                    Decline
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
