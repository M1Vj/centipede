"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl">Invite a member</CardTitle>
        <CardDescription>
          Send an invite using a mathlete name, email, or profile id.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="grid gap-2">
            <Label htmlFor="invitee">Invitee handle or id</Label>
            <Input
              id="invitee"
              value={invitee}
              onChange={(event) => setInvitee(event.target.value)}
              autoComplete="off"
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

          <div className="flex items-center justify-end">
            <Button type="submit" pending={isSubmitting} pendingText="Sending...">
              Send invite
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
