"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert } from "lucide-react";
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
  const [maximumMembers, setMaximumMembers] = useState("");
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
  const trimmedName = name.trim();
  const showAvailability = trimmedName.length >= 2;

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
    <form
      className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
      onSubmit={handleSubmit}
      aria-busy={isSubmitting}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-[-0.05em] text-[#1a1e2e]">
            Create New Team
          </h1>
          <p className="text-sm leading-7 text-slate-500">
            Form your team of elite mathletes and climb the ranks.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-name" className="text-sm font-bold uppercase tracking-[0.08em] text-[#1a1e2e]">
            Team Name
          </Label>
          <Input
            id="team-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Prime Factorials"
            maxLength={80}
            minLength={2}
            className="h-12 rounded-xl border-slate-200 bg-white px-4 text-base shadow-none"
            required
          />
          <p className={showAvailability ? "text-sm text-emerald-600" : "text-sm text-slate-400"}>
            {showAvailability ? `${trimmedName} is available` : "Prime Factorials is available"}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maximum-members" className="text-sm font-bold uppercase tracking-[0.08em] text-[#1a1e2e]">
            Maximum Members
          </Label>
          <Input
            id="maximum-members"
            value={maximumMembers}
            onChange={(event) => setMaximumMembers(event.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="e.g., 5"
            className="h-12 rounded-xl border-slate-200 bg-white px-4 text-base shadow-none"
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
          pendingText="Creating..."
          className="h-12 w-full rounded-xl bg-[#1a1e2e] px-8 text-sm font-bold text-white hover:bg-[#2a3147]"
        >
          Create Team
        </Button>
      </div>
    </form>
  );
}
