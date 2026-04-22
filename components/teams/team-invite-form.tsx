"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Lock, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { createIdempotencyToken, getPayloadMessage, requestJson } from "@/components/teams/utils";
import { isUuid } from "@/lib/teams/validation";
import { cn } from "@/lib/utils";

type TeamInviteResponse = {
  code?: string;
  message?: string;
};

type TeamInviteFormProps = {
  teamId: string;
  rosterLocked?: boolean;
  onInviteSent?: () => void;
  className?: string;
};

export function TeamInviteForm({
  teamId,
  rosterLocked = false,
  onInviteSent,
  className,
}: TeamInviteFormProps) {
  const [invitee, setInvitee] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting || rosterLocked) {
      return;
    }

    const trimmed = invitee.trim();
    if (!trimmed) {
      setStatus({
        type: "error",
        message: "Invitee handle or id is required.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({
      type: "pending",
      message: "Sending invite...",
    });

    try {
      const payload = isUuid(trimmed)
        ? { inviteeId: trimmed }
        : { inviteeHandle: trimmed };

      const response = await requestJson<TeamInviteResponse>(
        `/api/mathlete/teams/${teamId}/invites`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...payload,
            requestIdempotencyToken: createIdempotencyToken(),
          }),
        },
      );

      if (!response.ok) {
        setStatus({
          type: "error",
          message: getPayloadMessage(response.payload, response.message || "Invite failed."),
        });
        return;
      }

      const outcome = response.payload?.code;
      const successMessage = outcome === "already_invited"
        ? "Invite already sent."
        : "Invite sent.";

      setStatus({
        type: "success",
        message: successMessage,
      });
      setInvitee("");
      onInviteSent?.();
    } catch {
      setStatus({
        type: "error",
        message: "Invite could not be sent right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-[1.75rem] border-2 border-dashed border-slate-200 bg-white p-5 shadow-[0_22px_48px_-40px_rgba(15,23,42,0.35)]",
        rosterLocked ? "bg-slate-50/80" : "hover:border-[#f49700]/40",
        className,
      )}
    >
      <div className="space-y-3 pb-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef3dc] text-[#f49700] shadow-[0_12px_24px_-18px_rgba(244,151,0,0.55)]">
          {rosterLocked ? <Lock className="size-4" /> : <PlusCircle className="size-4" />}
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">Invite New Member</p>
          <h2 className="font-display text-2xl font-black tracking-[-0.03em] text-[#1a1e2e]">
            {rosterLocked ? "Invites are paused while the roster is locked." : "Bring another mathlete into the lineup."}
          </h2>
        </div>
        <p className="text-sm leading-7 text-slate-500">
          {rosterLocked
            ? "Team structure changes are disabled during the active registered competition window."
            : "Use a mathlete handle, email, or profile id. New invites appear immediately in the pending list."}
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="grid gap-2">
            <Label htmlFor="invitee" className="text-sm font-semibold text-[#1a1e2e]">
              Invitee handle or id
            </Label>
            <Input
              id="invitee"
              value={invitee}
              onChange={(event) => setInvitee(event.target.value)}
              autoComplete="off"
              className="h-12 rounded-2xl border-slate-200 bg-[#fafafb] text-[#1a1e2e] placeholder:text-slate-400"
              placeholder="mathlete@email.com or profile id"
              disabled={rosterLocked}
              required
            />
          </div>

          <Button
            type="submit"
            pending={isSubmitting}
            pendingText="Sending..."
            disabled={rosterLocked}
            className="h-12 rounded-full bg-[#f49700] px-6 text-sm font-bold text-white shadow-[0_16px_30px_-18px_rgba(244,151,0,0.8)] hover:bg-[#de8a00]"
          >
            {rosterLocked ? "Locked" : "Send invite"}
          </Button>
        </div>

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={status.type}
            message={status.message}
            icon={status.type === "error" ? CircleAlert : status.type === "success" ? CheckCircle2 : undefined}
          />
        </div>
      </form>
    </div>
  );
}
