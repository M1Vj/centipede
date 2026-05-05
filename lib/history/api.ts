import {
  COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

type TeamMembershipRow = {
  team_id: string | null;
};

type RegistrationHistoryRow = {
  id: string;
  competition_id: string;
  status: string | null;
  registered_at: string;
  updated_at: string;
  team_id: string | null;
  profile_id: string | null;
};

type LeaderboardHistoryRow = {
  registration_id: string;
  rank: number | null;
  score: number | string | null;
  total_time_seconds: number | null;
  computed_at: string | null;
};

type CompetitionIdRow = {
  competition_id: string;
};

export type MathleteHistoryItem = {
  registrationId: string;
  competitionId: string;
  competitionName: string;
  competitionStatus: CompetitionRecord["status"];
  competitionType: CompetitionRecord["type"];
  leaderboardPublished: boolean;
  registrationStatus: string | null;
  registeredAt: string;
  updatedAt: string;
  rank: number | null;
  score: number | null;
  totalTimeSeconds: number | null;
  computedAt: string | null;
  hideLeaderboardMetrics: boolean;
};

export type OrganizerHistoryItem = {
  competitionId: string;
  competitionName: string;
  status: CompetitionRecord["status"];
  type: CompetitionRecord["type"];
  leaderboardPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  registrationCount: number;
  disputeCount: number;
  exportCount: number;
};

function isHistorySchemaCompatibilityError(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("competition_registrations") ||
    message.includes("leaderboard_entries") ||
    message.includes("problem_disputes") ||
    message.includes("export_jobs") ||
    message.includes("leaderboard_published")
  );
}

async function fetchCompetitionsByIds(
  supabase: ServerSupabaseClient,
  competitionIds: string[],
): Promise<CompetitionRecord[]> {
  if (competitionIds.length === 0) {
    return [];
  }

  const primary = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .in("id", competitionIds);

  if (!primary.error) {
    return (primary.data ?? [])
      .map((row) => normalizeCompetitionRecord(row))
      .filter((row): row is CompetitionRecord => row !== null);
  }

  if (!isLegacyCompetitionSelectError(primary.error)) {
    throw primary.error;
  }

  const fallback = await supabase
    .from("competitions")
    .select(LEGACY_COMPETITION_SELECT_COLUMNS)
    .in("id", competitionIds);

  if (fallback.error) {
    throw fallback.error;
  }

  return (fallback.data ?? [])
    .map((row) => normalizeCompetitionRecord(row))
    .filter((row): row is CompetitionRecord => row !== null);
}

function normalizeFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export async function listMathleteHistory(input: {
  profileId: string;
}): Promise<MathleteHistoryItem[]> {
  const supabase = await createClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", input.profileId)
    .eq("is_active", true)
    .returns<TeamMembershipRow[]>();

  if (membershipError) {
    throw membershipError;
  }

  const activeTeamIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((membership) => membership.team_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const individualRegistrationsPromise = supabase
    .from("competition_registrations")
    .select("id, competition_id, status, registered_at, updated_at, team_id, profile_id")
    .eq("profile_id", input.profileId)
    .order("registered_at", { ascending: false })
    .returns<RegistrationHistoryRow[]>();

  const teamRegistrationsPromise =
    activeTeamIds.length > 0
      ? supabase
        .from("competition_registrations")
        .select("id, competition_id, status, registered_at, updated_at, team_id, profile_id")
        .in("team_id", activeTeamIds)
        .order("registered_at", { ascending: false })
        .returns<RegistrationHistoryRow[]>()
      : Promise.resolve({
        data: [] as RegistrationHistoryRow[],
        error: null,
      });

  const [individualResult, teamResult] = await Promise.all([
    individualRegistrationsPromise,
    teamRegistrationsPromise,
  ]);

  if (individualResult.error) {
    if (isHistorySchemaCompatibilityError(individualResult.error)) {
      return [];
    }

    throw individualResult.error;
  }

  if (teamResult.error) {
    if (isHistorySchemaCompatibilityError(teamResult.error)) {
      return [];
    }

    throw teamResult.error;
  }

  const registrationRows = [
    ...(individualResult.data ?? []),
    ...(teamResult.data ?? []),
  ];

  const dedupedRegistrationRows = Array.from(
    new Map(registrationRows.map((row) => [row.id, row])).values(),
  );

  const competitionIds = Array.from(
    new Set(dedupedRegistrationRows.map((registration) => registration.competition_id)),
  );
  const competitions = await fetchCompetitionsByIds(supabase, competitionIds);
  const competitionLookup = new Map(competitions.map((competition) => [competition.id, competition]));

  const registrationIds = dedupedRegistrationRows.map((row) => row.id);
  let leaderboardRows: LeaderboardHistoryRow[] = [];
  if (registrationIds.length > 0) {
    const leaderboardResult = await supabase
      .from("leaderboard_entries")
      .select("registration_id, rank, score, total_time_seconds, computed_at")
      .in("registration_id", registrationIds)
      .returns<LeaderboardHistoryRow[]>();

    if (leaderboardResult.error) {
      if (!isHistorySchemaCompatibilityError(leaderboardResult.error)) {
        throw leaderboardResult.error;
      }
    } else {
      leaderboardRows = leaderboardResult.data ?? [];
    }
  }

  const leaderboardLookup = new Map(
    leaderboardRows.map((row) => [row.registration_id, row]),
  );

  return dedupedRegistrationRows
    .map((registration) => {
      const competition = competitionLookup.get(registration.competition_id);
      if (!competition || competition.isDeleted) {
        return null;
      }

      const leaderboard = leaderboardLookup.get(registration.id);
      const hideLeaderboardMetrics =
        competition.type === "scheduled" && !competition.leaderboardPublished;

      return {
        registrationId: registration.id,
        competitionId: competition.id,
        competitionName: competition.name || "Competition",
        competitionStatus: competition.status,
        competitionType: competition.type,
        leaderboardPublished: competition.leaderboardPublished,
        registrationStatus: registration.status,
        registeredAt: registration.registered_at,
        updatedAt: registration.updated_at,
        rank: hideLeaderboardMetrics ? null : (leaderboard?.rank ?? null),
        score: hideLeaderboardMetrics ? null : normalizeFiniteNumber(leaderboard?.score ?? null),
        totalTimeSeconds: hideLeaderboardMetrics
          ? null
          : (typeof leaderboard?.total_time_seconds === "number"
            ? leaderboard.total_time_seconds
            : null),
        computedAt: hideLeaderboardMetrics ? null : (leaderboard?.computed_at ?? null),
        hideLeaderboardMetrics,
      } satisfies MathleteHistoryItem;
    })
    .filter((row): row is MathleteHistoryItem => row !== null)
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();
      return rightTime - leftTime;
    });
}

export async function listOrganizerHistory(input: {
  organizerId: string;
}): Promise<OrganizerHistoryItem[]> {
  const supabase = await createClient();
  const primaryResult = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("organizer_id", input.organizerId)
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });

  const competitionRows = (() => {
    if (!primaryResult.error) {
      return primaryResult.data ?? [];
    }

    return null;
  })();

  let competitions: CompetitionRecord[];
  if (competitionRows) {
    competitions = competitionRows
      .map((row) => normalizeCompetitionRecord(row))
      .filter((row): row is CompetitionRecord => row !== null && !row.isDeleted);
  } else if (isLegacyCompetitionSelectError(primaryResult.error)) {
    const fallbackResult = await supabase
      .from("competitions")
      .select(LEGACY_COMPETITION_SELECT_COLUMNS)
      .eq("organizer_id", input.organizerId)
      .order("created_at", { ascending: false });

    if (fallbackResult.error) {
      if (isHistorySchemaCompatibilityError(fallbackResult.error)) {
        return [];
      }

      throw fallbackResult.error;
    }

    competitions = (fallbackResult.data ?? [])
      .map((row) => normalizeCompetitionRecord(row))
      .filter((row): row is CompetitionRecord => row !== null && !row.isDeleted);
  } else if (primaryResult.error) {
    if (isHistorySchemaCompatibilityError(primaryResult.error)) {
      return [];
    }

    throw primaryResult.error;
  } else {
    competitions = [];
  }

  if (competitions.length === 0) {
    return [];
  }

  const competitionIds = competitions.map((competition) => competition.id);

  const [registrationRowsResult, disputeRowsResult, exportRowsResult] = await Promise.all([
    supabase
      .from("competition_registrations")
      .select("competition_id")
      .in("competition_id", competitionIds)
      .returns<CompetitionIdRow[]>(),
    supabase
      .from("problem_disputes")
      .select("competition_id")
      .in("competition_id", competitionIds)
      .returns<CompetitionIdRow[]>(),
    supabase
      .from("export_jobs")
      .select("competition_id")
      .in("competition_id", competitionIds)
      .returns<CompetitionIdRow[]>(),
  ]);

  const registrationCountLookup = (registrationRowsResult.error
    ? []
    : registrationRowsResult.data ?? []
  ).reduce<Map<string, number>>((lookup, row) => {
    lookup.set(row.competition_id, (lookup.get(row.competition_id) ?? 0) + 1);
    return lookup;
  }, new Map());

  const disputeCountLookup = (disputeRowsResult.error
    ? []
    : disputeRowsResult.data ?? []
  ).reduce<Map<string, number>>((lookup, row) => {
    lookup.set(row.competition_id, (lookup.get(row.competition_id) ?? 0) + 1);
    return lookup;
  }, new Map());

  const exportCountLookup = (exportRowsResult.error
    ? []
    : exportRowsResult.data ?? []
  ).reduce<Map<string, number>>((lookup, row) => {
    lookup.set(row.competition_id, (lookup.get(row.competition_id) ?? 0) + 1);
    return lookup;
  }, new Map());

  return competitions.map((competition) => ({
    competitionId: competition.id,
    competitionName: competition.name || "Competition",
    status: competition.status,
    type: competition.type,
    leaderboardPublished: competition.leaderboardPublished,
    publishedAt: competition.publishedAt,
    updatedAt: competition.updatedAt,
    registrationCount: registrationCountLookup.get(competition.id) ?? 0,
    disputeCount: disputeCountLookup.get(competition.id) ?? 0,
    exportCount: exportCountLookup.get(competition.id) ?? 0,
  }));
}
