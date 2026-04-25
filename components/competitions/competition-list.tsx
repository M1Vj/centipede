import { CalendarDays, Users2 } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { LocalDateTime } from "@/components/competitions/local-date-time";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

type CompetitionListProps = {
  competitions: DiscoverableCompetition[];
  registrationLookup: Record<
    string,
    { status: string | null; statusReason: string | null; teamId: string | null; id: string }
  >;
};

function formatFormatLabel(competition: DiscoverableCompetition) {
  if (competition.format === "team") {
    if (competition.participantsPerTeam) {
      return `Team (${competition.participantsPerTeam})`;
    }

    return "Team";
  }

  return "Individual";
}

function formatTypeLabel(competition: DiscoverableCompetition) {
  return competition.type === "scheduled" ? "Scheduled" : "Open";
}

function formatStatusBadge(status: string | null) {
  if (status === "registered") {
    return { label: "Registered", className: "bg-emerald-100 text-emerald-700" };
  }

  if (status === "ineligible") {
    return { label: "Ineligible", className: "bg-amber-100 text-amber-700" };
  }

  if (status === "withdrawn") {
    return { label: "Withdrawn", className: "bg-slate-100 text-slate-500" };
  }

  return null;
}

export function CompetitionList({ competitions, registrationLookup }: CompetitionListProps) {
  if (competitions.length === 0) {
    return (
      <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        No competitions match these filters yet.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {competitions.map((competition) => {
        const registration = registrationLookup[competition.id];
        const badge = formatStatusBadge(registration?.status ?? null);

        return (
          <article
            key={competition.id}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_-35px_rgba(15,23,42,0.25)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {formatTypeLabel(competition)}
                </p>
                <h3 className="text-xl font-semibold text-[#1a1e2e]">
                  {competition.name || "Untitled competition"}
                </h3>
                <p className="text-sm leading-6 text-slate-500">
                  {competition.description || "No description provided yet."}
                </p>
              </div>
              {badge ? (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${badge.className}`}
                >
                  {badge.label}
                </span>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                <Users2 className="size-4" />
                {formatFormatLabel(competition)}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
                <CalendarDays className="size-4" />
                <LocalDateTime
                  value={competition.startTime ?? competition.registrationStart}
                  options={{ month: "short", day: "numeric", year: "numeric" }}
                />
              </span>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Status: {competition.status}
              </div>
              <ProgressLink
                href={`/mathlete/competition/${competition.id}`}
                className="rounded-full bg-[#1a1e2e] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[#0f121a]"
              >
                View details
              </ProgressLink>
            </div>
          </article>
        );
      })}
    </div>
  );
}
