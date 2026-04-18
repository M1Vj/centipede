"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { createIdempotencyToken, getPayloadMessage, requestJson } from "@/components/teams/utils";
import { isUuid } from "@/lib/teams/validation";

type TeamInviteResponse = {
  code?: string;
  message?: string;
};

type TeamInviteFormProps = {
  teamId: string;
};

export function TeamInviteForm({ teamId }: TeamInviteFormProps) {
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

    if (isSubmitting) {
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
    <div className="rounded-[2rem] border border-white/10 bg-[#10182b] p-5 text-white shadow-[0_30px_64px_-40px_rgba(16,24,43,0.9)]">
      <div className="space-y-3 pb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-white/10 text-[#f49700]">
          <Send className="size-4" />
        </div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-white">Invite member</h2>
        <p className="text-sm leading-7 text-white/65">
          Send an invite using a mathlete name, email, or profile id.
        </p>
      </div>
      <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="grid gap-2">
          <Label htmlFor="invitee" className="text-sm font-semibold text-white/82">
            Invitee handle or id
          </Label>
          <Input
            id="invitee"
            value={invitee}
            onChange={(event) => setInvitee(event.target.value)}
            autoComplete="off"
            className="h-12 rounded-2xl border-white/10 bg-white/6 text-white placeholder:text-white/35"
            required
          />
        </div>

        <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
          <FormStatusMessage
            status={status.type}
            message={status.message}
            icon={status.type === "error" ? CircleAlert : status.type === "success" ? CheckCircle2 : undefined}
          />
        </div>

        <Button
          type="submit"
          pending={isSubmitting}
          pendingText="Sending..."
          className="h-11 rounded-full bg-[#f49700] px-5 text-sm font-bold text-white hover:bg-[#e68b00]"
        >
          Send invite
        </Button>
      </form>
    </div>
  );
}
