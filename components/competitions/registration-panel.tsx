"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormStatusMessage } from "@/components/ui/feedback-states";
import { Label } from "@/components/ui/label";
import { useFormStatusRegion } from "@/hooks/use-form-status-region";
import { createIdempotencyToken } from "@/components/competitions/utils";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";
import type { RegistrationSummary } from "@/lib/registrations/types";

type LeaderTeam = {
  id: string;
  name: string;
  teamCode: string;
};

type RegistrationPanelProps = {
  competition: DiscoverableCompetition;
  individualRegistration: RegistrationSummary | null;
  teamRegistrations: RegistrationSummary[];
  leaderTeams: LeaderTeam[];
};

type ApiResponse = {
  code?: string;
  tone?: "success" | "warning" | "error";
  message?: string;
  registrationId?: string | null;
  status?: string | null;
  statusReason?: string | null;
};

function resolveRegistrationStatusMessage(registration: RegistrationSummary | null) {
  if (!registration) {
    return null;
  }

  if (registration.status === "registered") {
    return "You are registered for this competition.";
  }

  if (registration.status === "withdrawn") {
    return "You withdrew from this competition.";
  }

  if (registration.status === "ineligible") {
    return "This registration is marked ineligible. Fix roster constraints and re-register.";
  }

  return null;
}

export function CompetitionRegistrationPanel({
  competition,
  individualRegistration,
  teamRegistrations,
  leaderTeams,
}: RegistrationPanelProps) {
  const [selectedTeamId, setSelectedTeamId] = useState(leaderTeams[0]?.id ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<{
    type: "pending" | "error" | "success";
    message: string | null;
  }>({
    type: "pending",
    message: null,
  });
  const { statusId, statusRef } = useFormStatusRegion(status.message);
  const router = useRouter();

  const selectedTeamRegistration = useMemo(() => {
    if (competition.format !== "team") {
      return null;
    }

    return teamRegistrations.find((registration) => registration.team_id === selectedTeamId) ?? null;
  }, [competition.format, teamRegistrations, selectedTeamId]);

  const existingTeamRegistration = useMemo(() => {
    if (competition.format !== "team") {
      return null;
    }

    return (
      teamRegistrations.find((registration) => registration.status === "registered") ??
      selectedTeamRegistration
    );
  }, [competition.format, selectedTeamRegistration, teamRegistrations]);

  const activeRegistration = useMemo(() => {
    if (competition.format === "individual") {
      return individualRegistration;
    }

    return selectedTeamRegistration ?? existingTeamRegistration ?? null;
  }, [competition.format, individualRegistration, selectedTeamRegistration, existingTeamRegistration]);

  const registrationStatusMessage = resolveRegistrationStatusMessage(activeRegistration);
  const shouldSelectTeam = competition.format === "team";
  const showTeamSelector = shouldSelectTeam && leaderTeams.length > 0;
  const selectedTeam = leaderTeams.find((team) => team.id === selectedTeamId) ?? null;
  const leaderTeamIds = useMemo(() => new Set(leaderTeams.map((team) => team.id)), [leaderTeams]);
  const canWithdraw =
    activeRegistration?.status === "registered" &&
    (competition.format === "individual" ||
      (activeRegistration.team_id !== null && leaderTeamIds.has(activeRegistration.team_id)));
  const canRegister =
    competition.format === "individual"
      ? !activeRegistration || activeRegistration.status !== "registered"
      : existingTeamRegistration?.status !== "registered";

  const submitRegister = async () => {
    if (isSubmitting) {
      return;
    }

    if (competition.format === "team" && !selectedTeam) {
      setStatus({
        type: "error",
        message: "Select a team to register.",
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({
      type: "pending",
      message: "Submitting registration...",
    });

    try {
      const response = await fetch("/api/mathlete/competition/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionId: competition.id,
          teamId: competition.format === "team" ? selectedTeam?.id ?? null : null,
          requestIdempotencyToken: createIdempotencyToken(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      const message = payload.message || "Registration failed.";

      if (!response.ok || payload.tone === "error") {
        setStatus({
          type: "error",
          message,
        });
        return;
      }

      setStatus({
        type: payload.tone === "success" ? "success" : "error",
        message,
      });

      if (payload.tone === "success") {
        router.refresh();
      }
    } catch {
      setStatus({
        type: "error",
        message: "Registration failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitWithdraw = async () => {
    if (!activeRegistration?.id || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setStatus({
      type: "pending",
      message: "Submitting withdrawal...",
    });

    try {
      const response = await fetch("/api/mathlete/competition/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registrationId: activeRegistration.id,
          competitionId: competition.id,
          statusReason: competition.format === "team" ? "team_withdrew" : "participant_withdrew",
          requestIdempotencyToken: createIdempotencyToken(),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ApiResponse;
      const message = payload.message || "Withdrawal failed.";

      if (!response.ok || payload.tone === "error") {
        setStatus({
          type: "error",
          message,
        });
        return;
      }

      setStatus({
        type: payload.tone === "success" ? "success" : "error",
        message,
      });

      if (payload.tone === "success") {
        router.refresh();
      }
    } catch {
      setStatus({
        type: "error",
        message: "Withdrawal failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Registration</p>
        <h2 className="text-2xl font-black text-[#0f1c2c]">Join this competition</h2>
        <p className="text-sm text-slate-500">
          {competition.type === "scheduled"
            ? "Registration windows and start times are enforced by the server."
            : "Open competitions accept registrations while they remain published."}
        </p>
      </div>

      {registrationStatusMessage ? (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {registrationStatusMessage}
        </div>
      ) : null}

      {showTeamSelector ? (
        <div className="mt-5 grid gap-2">
          <Label htmlFor="registration-team" className="text-sm font-semibold text-slate-700">
            Select team
          </Label>
          <select
            id="registration-team"
            value={selectedTeamId}
            onChange={(event) => setSelectedTeamId(event.target.value)}
            className="h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm text-[#0f1c2c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f49700]"
          >
            {leaderTeams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.teamCode})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {shouldSelectTeam && leaderTeams.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          You need to be a team leader to register a team competition.
        </div>
      ) : null}

      {activeRegistration?.status === "ineligible" && activeRegistration.status_reason ? (
        <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Current ineligible reason: {activeRegistration.status_reason.replace(/_/g, " ")}
        </div>
      ) : null}

      <div id={statusId} ref={statusRef} tabIndex={-1} className="mt-5 focus:outline-none">
        <FormStatusMessage
          status={status.type}
          message={status.message}
          icon={status.type === "error" ? CircleAlert : status.type === "success" ? CheckCircle2 : undefined}
        />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={submitRegister}
          disabled={!canRegister || (shouldSelectTeam && !selectedTeam)}
          pending={isSubmitting}
          pendingText="Submitting..."
          className="h-11 rounded-xl bg-[#f49700] px-6 text-sm font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-[#f49700]/30 hover:bg-[#e08900]"
        >
          Register now
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={submitWithdraw}
          disabled={!canWithdraw}
          className="h-11 rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-bold text-[#0f1c2c] hover:bg-slate-50"
        >
          Withdraw
        </Button>
      </div>
    </section>
  );
}
