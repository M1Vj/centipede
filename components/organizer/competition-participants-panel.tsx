import { CalendarClock, CheckCircle2, CircleSlash, Clock3, UserRound, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressLink } from "@/components/ui/progress-link";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { OrganizerRegistrationDetail } from "@/lib/registrations/types";

interface CompetitionParticipantsPanelProps {
  competition: CompetitionRecord;
  registrations: OrganizerRegistrationDetail[];
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusClass(status: OrganizerRegistrationDetail["status"]) {
  switch (status) {
    case "registered":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "withdrawn":
      return "border-slate-200 bg-slate-50 text-slate-600";
    case "ineligible":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function countByStatus(
  registrations: OrganizerRegistrationDetail[],
  status: OrganizerRegistrationDetail["status"],
) {
  return registrations.filter((registration) => registration.status === status).length;
}

function capacityLabel(competition: CompetitionRecord, registeredCount: number) {
  const limit = competition.format === "team" ? competition.maxTeams : competition.maxParticipants;
  if (!limit || limit <= 0) {
    return `${registeredCount}`;
  }

  return `${registeredCount} / ${limit}`;
}

export function CompetitionParticipantsPanel({
  competition,
  registrations,
}: CompetitionParticipantsPanelProps) {
  const registeredCount = countByStatus(registrations, "registered");
  const withdrawnCount = countByStatus(registrations, "withdrawn");
  const ineligibleCount = countByStatus(registrations, "ineligible");
  const cancelledCount = countByStatus(registrations, "cancelled");
  const canHaveRegistrations = competition.status !== "draft";

  return (
    <div className="space-y-6 font-['Poppins']">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ProgressLink
          href="/organizer/competition"
          className="text-sm font-bold text-slate-500 transition-colors hover:text-[#f49700]"
        >
          Back to Competitions
        </ProgressLink>
        <ProgressLink
          href={`/organizer/competition/${competition.id}`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#10182b] shadow-sm transition hover:bg-slate-50"
        >
          Competition setup
        </ProgressLink>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0px_4px_12px_rgba(0,0,0,0.03)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-[#fed7aa] bg-[#fff7ed] text-[#c2410c] hover:bg-[#fff7ed]">
                {competition.status}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {competition.format}
              </Badge>
              <Badge variant="outline" className="capitalize">
                {competition.type}
              </Badge>
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#10182b]">
                {competition.name || "Untitled competition"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Registered participant management for this published competition.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-semibold text-slate-800">
              <CalendarClock className="size-4 text-[#f49700]" />
              {formatDateTime(competition.startTime)}
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500">
              Registration closes {formatDateTime(competition.registrationEnd)}
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Registered</p>
          <p className="mt-2 text-2xl font-black text-[#10182b]">{capacityLabel(competition, registeredCount)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Withdrawn</p>
          <p className="mt-2 text-2xl font-black text-[#10182b]">{withdrawnCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ineligible</p>
          <p className="mt-2 text-2xl font-black text-[#10182b]">{ineligibleCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cancelled</p>
          <p className="mt-2 text-2xl font-black text-[#10182b]">{cancelledCount}</p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-[0px_4px_12px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-[#10182b]">Participants</h2>
            <p className="text-sm font-medium text-slate-500">
              {competition.format === "team" ? "Registered teams and roster snapshots." : "Registered mathletes."}
            </p>
          </div>
          <Badge variant="outline">{registrations.length} total</Badge>
        </div>

        {!canHaveRegistrations ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Clock3 className="mb-4 size-10 text-slate-300" />
            <p className="font-bold text-slate-700">Publish this competition before registrations open.</p>
          </div>
        ) : registrations.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <UsersRound className="mb-4 size-10 text-slate-300" />
            <p className="font-bold text-slate-700">No registrations yet</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Registered participants will appear here as mathletes join the competition.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {registrations.map((registration) => (
              <article key={registration.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {registration.teamId ? (
                        <UsersRound className="size-4 text-slate-400" />
                      ) : (
                        <UserRound className="size-4 text-slate-400" />
                      )}
                      <h3 className="font-bold text-[#10182b]">{registration.displayName}</h3>
                      {registration.subtitle ? (
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
                          {registration.subtitle}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Registered {formatDateTime(registration.registeredAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={statusClass(registration.status)}>
                      {registration.status}
                    </Badge>
                    {registration.status === "registered" ? (
                      <CheckCircle2 className="size-4 text-emerald-600" />
                    ) : (
                      <CircleSlash className="size-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {registration.statusReason ? (
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    Reason: {registration.statusReason}
                  </p>
                ) : null}

                {registration.roster.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {registration.roster.map((participant, index) => (
                      <div
                        key={`${registration.id}-${participant.profileId ?? index}`}
                        className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-sm md:grid-cols-[1.4fr_1fr_0.8fr_0.6fr]"
                      >
                        <span className="font-semibold text-slate-800">{participant.fullName}</span>
                        <span className="text-slate-600">{participant.school ?? "School not provided"}</span>
                        <span className="text-slate-600">{participant.gradeLevel ?? "Grade not provided"}</span>
                        <span className="capitalize text-slate-500">{participant.role ?? "Participant"}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
