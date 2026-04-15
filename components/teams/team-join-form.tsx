"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { useFeedbackRouter } from "@/hooks/use-feedback-router";
import { createIdempotencyToken, getPayloadMessage, requestJson } from "@/components/teams/utils";

type TeamJoinResponse = {
  code?: string;
  message?: string;
};

export function TeamJoinForm() {
  const [teamCode, setTeamCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const { statusId, statusRef } = useFormStatusRegion(status.message);
  const feedbackRouter = useFeedbackRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedCode = teamCode.trim().toUpperCase();
    if (!normalizedCode) {
      setStatus({
        type: "error",
        message: "Unable to join team with this code.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({
      type: "pending",
      message: "Joining team...",
    });

    try {
      const response = await requestJson<TeamJoinResponse>("/api/mathlete/teams/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teamCode: normalizedCode,
          requestIdempotencyToken: createIdempotencyToken(),
        }),
      });

      if (!response.ok) {
        setStatus({
          type: "error",
          message: getPayloadMessage(response.payload, "Unable to join team with this code."),
        });
        return;
      }

      const outcome = response.payload?.code;
      const successMessage =
        outcome === "already_member"
          ? "You are already on this team."
          : "Team joined. Redirecting to your teams...";

      setStatus({
        type: "success",
        message: successMessage,
      });
      feedbackRouter.push("/mathlete/teams");
    } catch {
      setStatus({
        type: "error",
        message: "Unable to join team right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Join a team</CardTitle>
        <CardDescription>
          Enter the 10-character team code shared by your team leader.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="grid gap-2">
            <Label htmlFor="team-code">Team code</Label>
            <Input
              id="team-code"
              value={teamCode}
              onChange={(event) => setTeamCode(event.target.value.toUpperCase())}
              maxLength={10}
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
            <Button type="submit" pending={isSubmitting} pendingText="Joining...">
              Join team
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
