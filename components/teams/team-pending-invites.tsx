"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Clock3, MailPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, FormStatusMessage, LoadingState } from "@/components/ui/feedback-states";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { createIdempotencyToken, formatDate, getPayloadMessage, requestJson } from "@/components/teams/utils";
import type { TeamPendingInvite, TeamPendingInvitesResponse } from "@/components/teams/types";
import { cn } from "@/lib/utils";

const defaultErrorMessage = "Unable to load pending invites.";

type InviteRevokeResponse = {
  code?: string;
  message?: string;
};

type TeamPendingInvitesProps = {
  teamId: string;
  rosterLocked?: boolean;
  refreshToken?: number;
  className?: string;
};

export function TeamPendingInvites({
  teamId,
  rosterLocked = false,
  refreshToken = 0,
  className,
}: TeamPendingInvitesProps) {
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
  }, [teamId, refreshToken]);

  const handleRevoke = async (inviteId: string) => {
    if (pendingAction || rosterLocked) {
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
      <div className={cn("rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_48px_-40px_rgba(15,23,42,0.35)]", className)}>
        <EmptyState
          title="No pending invites"
          description={rosterLocked
            ? "Roster changes are currently locked, so pending invites cannot be updated."
            : "Invitations you send will appear here until they are accepted or declined."}
        />
      </div>
    );
  }

  return (
    <div className={cn("rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_22px_48px_-40px_rgba(15,23,42,0.35)]", className)}>
      <div className="space-y-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1a1e2e] text-[#f49700] shadow-[0_18px_30px_-24px_rgba(26,30,46,0.85)]">
          <MailPlus className="size-4" />
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Pending Invites</p>
          <h2 className="font-display text-2xl font-black tracking-[-0.03em] text-[#1a1e2e]">Track who is still waiting on your roster.</h2>
        </div>
        <p className="text-sm leading-7 text-slate-500">
          {rosterLocked
            ? "Pending invites stay visible, but revoking is disabled while the roster is locked."
            : "Track outgoing invitations and revoke them if plans change before the roster closes."}
        </p>
      </div>

      <div className="mt-5 space-y-4">
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
                className="flex flex-col gap-4 rounded-[1.35rem] border border-slate-200/80 bg-[#fafafb] p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#1a1e2e]">{name}</p>
                  <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <Clock3 className="size-3.5" />
                    Invited {formatDate(invite.createdAt)}
                    {details ? ` | ${details}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                  onClick={() => void handleRevoke(invite.id)}
                  pending={isPending}
                  pendingText="Revoking..."
                  disabled={Boolean(pendingAction) || rosterLocked}
                >
                  {rosterLocked ? "Locked" : "Revoke"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
