"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, Users2 } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { Button } from "@/components/ui/button";
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
    <form className="space-y-6" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="rounded-[2rem] border border-slate-200/80 bg-[#fcfaf6] p-5 sm:p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#f49700]/12 text-[#f49700]">
          <Users2 className="size-6" />
        </div>
        <div className="mt-5 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            Private mathlete squad
          </p>
          <p className="max-w-lg text-sm leading-7 text-slate-500">
            Teams let you coordinate with schoolmates before team competitions go live.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="team-name" className="text-sm font-semibold text-slate-700">
          Team Name
        </Label>
        <Input
          id="team-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={80}
          minLength={2}
          className="h-14 rounded-2xl border-slate-200 bg-white px-4 text-base shadow-none"
          required
        />
        <p className="text-xs tracking-[0.08em] text-slate-400 uppercase">Use 2 to 80 characters.</p>
      </div>

      <div id={statusId} ref={statusRef} tabIndex={-1} className="focus:outline-none">
        <FormStatusMessage
          status={status.type}
          message={status.message}
          icon={status.type === "error" ? CircleAlert : status.type === "success" ? CheckCircle2 : undefined}
        />
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Button asChild type="button" variant="ghost" className="h-12 rounded-full px-5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
          <ProgressLink href="/mathlete/teams">Cancel</ProgressLink>
        </Button>
        <Button
          type="submit"
          pending={isSubmitting}
          pendingText="Creating..."
          className="h-12 rounded-full bg-[#f49700] px-8 text-sm font-bold text-white hover:bg-[#e68b00]"
        >
          Create Team
        </Button>
      </div>
    </form>
  );
}
