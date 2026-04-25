import { notFound } from "next/navigation";
import { ArenaExperience } from "@/components/arena/arena-experience";
import { CompetitionDetailPanel } from "@/components/competitions/competition-detail-panel";
import { CompetitionEventNotices } from "@/components/competitions/competition-event-notices";
import { CompetitionRegistrationPanel } from "@/components/competitions/registration-panel";
import { MathletePageFrame } from "@/components/mathlete/page-frame";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { loadArenaPageData } from "@/lib/arena/server";
import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import { fetchCompetitionEventNotices } from "@/lib/competition/events";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";
import type { RegistrationStatus, RegistrationSummary } from "@/lib/registrations/types";
import { createClient } from "@/lib/supabase/server";

type LeaderTeam = {
  id: string;
  name: string;
  teamCode: string;
};

type RegistrationRow = {
  id: string;
  competition_id: string;
  team_id: string | null;
  status: RegistrationStatus | null;
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

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });

  if (!profile) {
    notFound();
  }

  const supabase = await createClient();
  const { competitionId } = await params;
  const rawCompetition = await fetchCompetitionById(supabase, competitionId);
  const normalized = rawCompetition ? normalizeCompetitionRecord(rawCompetition) : null;

  if (!normalized || normalized.isDeleted || !DISCOVERABLE_STATUSES.has(normalized.status)) {
    notFound();
  }

  const competition = toDiscoverableCompetition(normalized);

  const individualRegistrationQuery = supabase
    .from("competition_registrations")
    .select("id, competition_id, team_id, status, status_reason")
    .eq("competition_id", competition.id)
    .eq("profile_id", profile.id);

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
    .eq("profile_id", profile.id)
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
      teamRegistrations = (teamRegResult.data ?? []).map((row) => ({
        id: row.id,
        competition_id: row.competition_id,
        team_id: row.team_id ?? null,
        status: normalizeRegistrationStatus(row.status),
        status_reason: row.status_reason ?? null,
      }));
    }
  }

  const modeRegistration =
    individualRegistration?.status === "registered"
      ? individualRegistration
      : (teamRegistrations.find((registration) => registration.status === "registered") as
          | RegistrationRow
          | undefined) ?? null;

  if (competition.type === "open" || modeRegistration) {
    const arenaData = await loadArenaPageData(competition.id, profile.id);

    if (!arenaData) {
      notFound();
    }

    if (competition.type === "open" || arenaData.mode !== "detail_register") {
      return <ArenaExperience initialData={arenaData} />;
    }
  }

  const eventNotices = await fetchCompetitionEventNotices(competition.id);

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
