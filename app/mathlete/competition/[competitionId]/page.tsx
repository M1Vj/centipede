import { notFound } from "next/navigation";
import { MathletePageFrame } from "@/components/mathlete/page-frame";
import { CompetitionDetailPanel } from "@/components/competitions/competition-detail-panel";
import { CompetitionEventNotices } from "@/components/competitions/competition-event-notices";
import { CompetitionRegistrationPanel } from "@/components/competitions/registration-panel";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import { fetchCompetitionEventNotices } from "@/lib/competition/events";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";
import type { RegistrationStatus, RegistrationSummary } from "@/lib/registrations/types";
import { createClient } from "@/lib/supabase/server";

type LeaderTeam = {
  id: string;
  name: string;
  teamCode: string;
};

type AttemptRow = {
  status: string | null;
};

type CompetitionPageMode = "arena_runtime" | "pre_entry" | "detail_register";

type RegistrationRow = {
  id: string;
  competition_id: string;
  team_id: string | null;
  status: string | null;
  status_reason: string | null;
};

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

const DISCOVERABLE_STATUSES = new Set(["published", "live", "paused"]);

function normalizeRegistrationStatus(value: unknown): RegistrationStatus | null {
  if (value === "registered" || value === "withdrawn" || value === "ineligible" || value === "cancelled") {
    return value;
  }

  return null;
}

function isMissingRegistrationSchema(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("competition_registrations") ||
    message.includes("competition_id")
  );
}

function isMissingAttemptsSchema(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";
  return error.code === "42P01" || message.includes("competition_attempts");
}

function toDiscoverableCompetition(competition: CompetitionRecord): DiscoverableCompetition {
  return {
    id: competition.id,
    name: competition.name,
    description: competition.description,
    instructions: competition.instructions,
    type: competition.type,
    format: competition.format,
    status: competition.status,
    registrationStart: competition.registrationStart,
    registrationEnd: competition.registrationEnd,
    startTime: competition.startTime,
    endTime: competition.endTime,
    durationMinutes: competition.durationMinutes,
    attemptsAllowed: competition.attemptsAllowed,
    maxParticipants: competition.maxParticipants,
    participantsPerTeam: competition.participantsPerTeam,
    maxTeams: competition.maxTeams,
  };
}

async function fetchCompetitionById(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const primary = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (!primary.error) {
    return primary.data;
  }

  if (!isLegacyCompetitionSelectError(primary.error)) {
    throw primary.error;
  }

  const fallback = await supabase
    .from("competitions")
    .select(LEGACY_COMPETITION_SELECT_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (fallback.error) {
    throw fallback.error;
  }

  return fallback.data;
}

async function resolveCompetitionPageMode(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  registration: RegistrationRow | null;
}): Promise<CompetitionPageMode> {
  const registration = input.registration;

  if (!registration || registration.status !== "registered") {
    return "detail_register";
  }

  const { data, error } = await input.supabase
    .from("competition_attempts")
    .select("status")
    .eq("registration_id", registration.id)
    .order("started_at", { ascending: false })
    .limit(1);

  if (error) {
    if (isMissingAttemptsSchema(error as SupabaseError)) {
      return "pre_entry";
    }

    throw error;
  }

  const status = (data?.[0] as AttemptRow | undefined)?.status ?? null;

  if (status === "in_progress") {
    return "arena_runtime";
  }

  if (status === "submitted" || status === "auto_submitted" || status === "graded" || status === "disqualified") {
    return "detail_register";
  }

  return "pre_entry";
}

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });
  const supabase = await createClient();
  const resolvedParams = await params;

  const rawCompetition = await fetchCompetitionById(supabase, resolvedParams.competitionId);
  const normalized = rawCompetition ? normalizeCompetitionRecord(rawCompetition) : null;

  if (!normalized || normalized.isDeleted || !DISCOVERABLE_STATUSES.has(normalized.status)) {
    notFound();
  }

  const competition = toDiscoverableCompetition(normalized);
  const eventNotices = await fetchCompetitionEventNotices(competition.id);

  const individualRegistrationQuery = supabase
    .from("competition_registrations")
    .select("id, competition_id, team_id, status, status_reason")
    .eq("competition_id", competition.id)
    .eq("profile_id", profile?.id ?? "");

  const individualResult = await individualRegistrationQuery.maybeSingle<RegistrationRow>();
  const individualRegistration = individualResult.error
    ? isMissingRegistrationSchema(individualResult.error)
      ? null
      : (() => {
          throw individualResult.error;
        })()
    : individualResult.data
      ? {
          id: individualResult.data.id,
          competition_id: individualResult.data.competition_id,
          team_id: individualResult.data.team_id ?? null,
          status: normalizeRegistrationStatus(individualResult.data.status),
          status_reason: individualResult.data.status_reason ?? null,
        }
      : null;

  const { data: leaderMemberships } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", profile?.id ?? "")
    .eq("role", "leader")
    .eq("is_active", true);

  const leaderTeamIds = (leaderMemberships ?? [])
    .map((row) => row.team_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const leaderTeams: LeaderTeam[] = leaderTeamIds.length
    ? (
        await supabase
          .from("teams")
          .select("id, name, team_code, is_archived")
          .in("id", leaderTeamIds)
      ).data
        ?.filter((row) => !row.is_archived)
        .map((row) => ({
          id: row.id,
          name: row.name,
          teamCode: row.team_code,
        })) ?? []
    : [];

  let teamRegistrations: RegistrationSummary[] = [];
  if (leaderTeamIds.length > 0) {
    const teamRegResult = await supabase
      .from("competition_registrations")
      .select("id, competition_id, team_id, status, status_reason")
      .eq("competition_id", competition.id)
      .in("team_id", leaderTeamIds);

    if (teamRegResult.error) {
      if (!isMissingRegistrationSchema(teamRegResult.error)) {
        throw teamRegResult.error;
      }
    } else {
      teamRegistrations = (teamRegResult.data ?? []) as RegistrationSummary[];
    }
  }

  const modeRegistration =
    individualRegistration?.status === "registered"
      ? individualRegistration
      : (teamRegistrations.find((registration) => registration.status === "registered") as
          | RegistrationRow
          | undefined) ?? null;

  const pageMode = await resolveCompetitionPageMode({
    supabase,
    registration: modeRegistration,
  });

  if (pageMode === "arena_runtime" || pageMode === "pre_entry") {
    return (
      <MathletePageFrame
        eyebrow="Competition entry"
        title={competition.name || "Competition entry"}
        description="Arena entry will be activated once the arena experience lands."
        actions={
          <ProgressLink
            href="/mathlete/competition"
            className="rounded-full bg-[#1a1e2e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f121a]"
          >
            Back to discovery
          </ProgressLink>
        }
      >
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          {pageMode === "arena_runtime"
            ? "Arena runtime is not available in this branch yet."
            : "Pre-entry preparation is queued for the arena branch."}
        </div>
      </MathletePageFrame>
    );
  }

  return (
    <MathletePageFrame
      eyebrow="Competition detail"
      title={competition.name || "Competition"}
      description="Review the competition rules and register when you're ready."
      actions={
        <ProgressLink
          href="/mathlete/competition"
          className="rounded-full bg-[#1a1e2e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f121a]"
        >
          Back to discovery
        </ProgressLink>
      }
    >
        {eventNotices.length > 0 ? <CompetitionEventNotices notices={eventNotices} /> : null}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <CompetitionDetailPanel competition={competition} />
        <CompetitionRegistrationPanel
          competition={competition}
          individualRegistration={
            individualRegistration
              ? {
                  id: individualRegistration.id,
                  competition_id: individualRegistration.competition_id,
                  team_id: individualRegistration.team_id ?? null,
                  status: individualRegistration.status,
                  status_reason: individualRegistration.status_reason ?? null,
                }
              : null
          }
          teamRegistrations={teamRegistrations}
          leaderTeams={leaderTeams}
        />
      </div>
    </MathletePageFrame>
  );
}
