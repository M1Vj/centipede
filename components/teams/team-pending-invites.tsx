"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, FormStatusMessage, LoadingState } from "@/components/ui/feedback-states";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { createIdempotencyToken, formatDate, getPayloadMessage, requestJson } from "@/components/teams/utils";
import type { TeamPendingInvite, TeamPendingInvitesResponse } from "@/components/teams/types";

const defaultErrorMessage = "Unable to load pending invites.";

type InviteRevokeResponse = {
  code?: string;
  message?: string;
};

type TeamPendingInvitesProps = {
  teamId: string;
};

export function TeamPendingInvites({ teamId }: TeamPendingInvitesProps) {
  const [invites, setInvites] = useState<TeamPendingInvite[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState(defaultErrorMessage);
  const [actionStatus, setActionStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const { statusId, statusRef } = useFormStatusRegion(actionStatus.message);

  useEffect(() => {
    let isActive = true;

    const loadInvites = async () => {
      setStatus("loading");
      const response = await requestJson<TeamPendingInvitesResponse>(
        `/api/mathlete/teams/${teamId}/invites`,
      );

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
  }, [teamId]);

  const handleRevoke = async (inviteId: string) => {
    if (pendingAction) {
      return;
    }

    setPendingAction(inviteId);
    setActionStatus({
      type: "pending",
      message: "Revoking invite...",
    });

    try {
      const response = await requestJson<InviteRevokeResponse>(
        `/api/mathlete/teams/invites/${inviteId}`,
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
          message: getPayloadMessage(response.payload, response.message || "Invite revoke failed."),
        });
        return;
      }

      setInvites((current) => current.filter((invite) => invite.id !== inviteId));
      setActionStatus({
        type: "success",
        message: "Invite revoked.",
      });
    } catch {
      setActionStatus({
        type: "error",
        message: "Invite revoke failed. Please try again.",
      });
    } finally {
      setPendingAction(null);
    }
  };

  if (status === "loading") {
    return (
      <LoadingState
        title="Loading pending invites"
        description="Checking for outstanding team invitations."
      />
    );
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Unable to load pending invites"
        description={errorMessage}
      />
    );
  }

  if (invites.length === 0) {
    return (
      <EmptyState
        title="No pending invites"
        description="Invitations you send will appear here until they are accepted or declined."
      />
    );
  }

  return (
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Pending invites</CardTitle>
        <CardDescription>Track outgoing invitations and revoke if needed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={actionStatus.type}
            message={actionStatus.message}
            icon={actionStatus.type === "error" ? CircleAlert : actionStatus.type === "success" ? CheckCircle2 : undefined}
          />
        </div>

        <div className="space-y-3">
          {invites.map((invite) => {
            const name = invite.invitee?.fullName?.trim() || "Mathlete";
            const details = [invite.invitee?.school, invite.invitee?.gradeLevel]
              .filter(Boolean)
              .join(" | ");
            const isPending = pendingAction === invite.id;

            return (
              <div
                key={invite.id}
                className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/80 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited {formatDate(invite.createdAt)}
                    {details ? ` | ${details}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleRevoke(invite.id)}
                  pending={isPending}
                  pendingText="Revoking..."
                  disabled={Boolean(pendingAction)}
                >
                  Revoke
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
