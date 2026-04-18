"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, KeyRound } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { Button } from "@/components/ui/button";
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
    <form className="space-y-6" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <div className="rounded-[2rem] border border-slate-200/80 bg-[#fcfaf6] p-5 sm:p-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-[1.35rem] bg-[#f49700]/12 text-[#f49700]">
          <KeyRound className="size-6" />
        </div>
        <div className="mt-5 space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            Have team code?
          </p>
          <p className="max-w-lg text-sm leading-7 text-slate-500">
            Enter the 10-character team code shared by your team leader.
          </p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="team-code" className="text-sm font-semibold text-slate-700">
          Team Code
        </Label>
        <Input
          id="team-code"
          value={teamCode}
          onChange={(event) => setTeamCode(event.target.value.toUpperCase())}
          maxLength={10}
          autoComplete="off"
          className="h-14 rounded-2xl border-slate-200 bg-white px-4 font-semibold uppercase tracking-[0.16em] shadow-none"
          required
        />
        <p className="text-xs tracking-[0.08em] text-slate-400 uppercase">Code format example: MW-4X9K2.</p>
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
          pendingText="Joining..."
          className="h-12 rounded-full bg-[#f49700] px-8 text-sm font-bold text-white hover:bg-[#e68b00]"
        >
          Join Team
        </Button>
      </div>
    </form>
  );
}
