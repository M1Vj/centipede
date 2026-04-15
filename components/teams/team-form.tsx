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
import { getPayloadMessage, requestJson } from "@/components/teams/utils";
import type { TeamRecord } from "@/components/teams/types";

type TeamCreateResponse = {
  code: string;
  team?: TeamRecord;
};

export function TeamForm() {
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const feedbackRouter = useFeedbackRouter();
  const { statusId, statusRef } = useFormStatusRegion(status.message);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus({
      type: "pending",
      message: "Creating your team...",
    });

    try {
      const response = await requestJson<TeamCreateResponse>("/api/mathlete/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (!response.ok || !response.payload?.team?.id) {
        setStatus({
          type: "error",
          message: getPayloadMessage(response.payload, "Unable to create the team."),
        });
        return;
      }

      setStatus({
        type: "success",
        message: "Team created. Redirecting to your roster...",
      });
      setName("");
      feedbackRouter.push(`/mathlete/teams/${response.payload.team.id}`);
    } catch {
      setStatus({
        type: "error",
        message: "Unable to create the team right now.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Create a team</CardTitle>
        <CardDescription>
          Teams let you coordinate with schoolmates before team competitions go live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
          <div className="grid gap-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={80}
              minLength={2}
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
            <Button type="submit" pending={isSubmitting} pendingText="Creating...">
              Create team
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
