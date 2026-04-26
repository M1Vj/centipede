import { CalendarDays, ShieldCheck, Timer, Users2 } from "lucide-react";
import { LocalDateTime } from "@/components/competitions/local-date-time";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

type CompetitionDetailPanelProps = {
  competition: DiscoverableCompetition;
};

function formatFormatLabel(competition: DiscoverableCompetition) {
  if (competition.format === "team") {
    if (competition.participantsPerTeam) {
      return `Team (${competition.participantsPerTeam} per team)`;
    }

    return "Team";
  }

  return "Individual";
}

function formatCapacityLabel(competition: DiscoverableCompetition) {
  if (competition.format === "team") {
    return competition.maxTeams ? `${competition.maxTeams} teams` : "Team capacity";
  }

  return competition.maxParticipants ? `${competition.maxParticipants} participants` : "Participant capacity";
}

function formatRegistrationStartFallback(competition: DiscoverableCompetition) {
  if (
    competition.type === "scheduled" &&
    !competition.registrationStart &&
    (competition.registrationEnd || competition.startTime)
  ) {
    return "Upon publication";
  }

  return "TBD";
}

function getEffectiveRegistrationEnd(competition: DiscoverableCompetition) {
  if (competition.type === "scheduled") {
    return competition.registrationEnd ?? competition.startTime;
  }

  return competition.registrationEnd;
}

export function CompetitionDetailPanel({ competition }: CompetitionDetailPanelProps) {
  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Overview</p>
        <h2 className="mt-2 text-2xl font-black text-[#0f1c2c]">
          {competition.name || "Untitled competition"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          {competition.description || "No description provided yet."}
        </p>

        <div className="mt-5 grid gap-3 text-sm text-slate-500 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Users2 className="size-4 text-[#f49700]" />
            {formatFormatLabel(competition)}
          </div>
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-[#f49700]" />
            {competition.durationMinutes} minutes
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-[#f49700]" />
            <LocalDateTime
              value={competition.startTime}
              options={{
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-[#f49700]" />
            {formatCapacityLabel(competition)}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Rules</p>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          {competition.instructions || "Rules and instructions will be shared here."}
        </p>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Schedule</p>
        <div className="mt-3 grid gap-3 text-sm text-slate-500">
          <div className="flex items-center justify-between">
            <span>Registration opens</span>
            <LocalDateTime
              value={competition.registrationStart}
              fallback={formatRegistrationStartFallback(competition)}
              options={{
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Registration closes</span>
            <LocalDateTime
              value={getEffectiveRegistrationEnd(competition)}
              options={{
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span>Competition start</span>
            <LocalDateTime
              value={competition.startTime}
              options={{
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
