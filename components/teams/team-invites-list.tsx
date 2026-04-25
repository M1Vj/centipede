"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

      <div className="grid gap-4">
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
          const initials = inviterName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase();

          return (
            <article
              key={invite.id}
              className="rounded-[2rem] border border-white/80 bg-white p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#10182b] text-sm font-bold text-white">
                    {initials || "M"}
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-semibold tracking-[-0.03em] text-[#10182b]">{teamName}</div>
                    <p className="text-sm leading-7 text-slate-500">
                      Invited by {inviterName}
                      {inviterDetails ? ` (${inviterDetails})` : ""}
                    </p>
                  </div>
                </div>

                <Badge variant="outline" className="rounded-full border-[#f49700]/20 bg-[#fff5e5] px-3 py-1 text-[#d67b00]">
                  Pending
                </Badge>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/70 p-4">
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      <CalendarClock className="size-3.5" />
                      Sent
                    </div>
                    <p className="mt-2 text-sm font-medium text-slate-600">{formatDate(invite.createdAt)}</p>
                  </div>
                  {teamCode ? (
                    <div className="rounded-[1.35rem] border border-slate-200/80 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Team Code</p>
                      <p className="mt-2 font-mono text-sm font-semibold tracking-[0.16em] text-[#13233b]">{teamCode}</p>
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Button
                    type="button"
                    className="h-11 rounded-full bg-[#f49700] px-5 text-sm font-bold text-white hover:bg-[#e68b00]"
                    onClick={() => void handleInviteAction(invite.id, "accept")}
                    pending={isAccepting}
                    pendingText="Accepting..."
                    disabled={Boolean(pendingAction)}
                  >
                    Accept invite
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-full border-slate-200 bg-white px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-800"
                    onClick={() => void handleInviteAction(invite.id, "decline")}
                    pending={isDeclining}
                    pendingText="Declining..."
                    disabled={Boolean(pendingAction)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
