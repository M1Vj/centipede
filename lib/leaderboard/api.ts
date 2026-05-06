import {
  COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { LeaderboardEntry, CompetitionLeaderboardView } from "@/lib/leaderboard/types";
import { canParticipantViewLeaderboard } from "@/lib/leaderboard/visibility";
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

type LeaderboardEntryRow = {
  id: string;
  competition_id: string;
  registration_id: string;
  attempt_id: string;
  rank: number | null;
  display_name: string | null;
  score: number | string | null;
  total_time_seconds: number | null;
  offense_count: number | null;
  published_visibility: boolean | null;
  computed_at: string | null;
};

const LEADERBOARD_ENTRY_SELECT_COLUMNS =
  "id, competition_id, registration_id, attempt_id, rank, display_name, score, total_time_seconds, offense_count, published_visibility, computed_at";

function normalizeFiniteInteger(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return fallback;
}

function normalizeFiniteNumber(value: unknown, fallback: number) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function normalizeLeaderboardEntry(row: LeaderboardEntryRow): LeaderboardEntry | null {
  const id = typeof row.id === "string" ? row.id : "";
  const competitionId = typeof row.competition_id === "string" ? row.competition_id : "";
  const registrationId = typeof row.registration_id === "string" ? row.registration_id : "";
  const attemptId = typeof row.attempt_id === "string" ? row.attempt_id : "";

  if (!id || !competitionId || !registrationId || !attemptId) {
    return null;
  }

  return {
    id,
    competitionId,
    registrationId,
    attemptId,
    rank: normalizeFiniteInteger(row.rank, 0),
    displayName: typeof row.display_name === "string" && row.display_name.trim() ? row.display_name : "Participant",
    score: normalizeFiniteNumber(row.score, 0),
    totalTimeSeconds: normalizeFiniteInteger(row.total_time_seconds, 0),
    offenseCount: normalizeFiniteInteger(row.offense_count, 0),
    publishedVisibility: row.published_visibility === true,
    computedAt: typeof row.computed_at === "string" ? row.computed_at : "",
  };
}

function isMissingLeaderboardSchemaError(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("leaderboard_entries") ||
    message.includes("problem_disputes") ||
    message.includes("export_jobs") ||
    message.includes("leaderboard_published")
  );
}

async function fetchCompetitionById(
  supabase: ServerSupabaseClient,
  competitionId: string,
): Promise<CompetitionRecord | null> {
  const primary = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .maybeSingle();

  if (!primary.error) {
    return normalizeCompetitionRecord(primary.data);
  }

  if (!isLegacyCompetitionSelectError(primary.error)) {
    throw primary.error;
  }

  const fallback = await supabase
    .from("competitions")
    .select(LEGACY_COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .maybeSingle();

  if (fallback.error) {
    throw fallback.error;
  }

  return normalizeCompetitionRecord(fallback.data);
}

async function resolveParticipantContext(
  supabase: ServerSupabaseClient,
  competitionId: string,
  profileId: string,
): Promise<boolean> {
  const individualRegistrationResult = await supabase
    .from("competition_registrations")
    .select("id")
    .eq("competition_id", competitionId)
    .eq("profile_id", profileId)
    .limit(1);

  if (individualRegistrationResult.error) {
    if (!isMissingLeaderboardSchemaError(individualRegistrationResult.error)) {
      throw individualRegistrationResult.error;
    }
  } else if ((individualRegistrationResult.data ?? []).length > 0) {
    return true;
  }

  const { data: memberships, error: membershipError } = await supabase
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .returns<TeamMembershipRow[]>();

  if (membershipError) {
    throw membershipError;
  }

  const teamIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((row) => row.team_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  if (teamIds.length > 0) {
    const teamRegistrationResult = await supabase
      .from("competition_registrations")
      .select("id")
      .eq("competition_id", competitionId)
      .in("team_id", teamIds)
      .limit(1);

    if (teamRegistrationResult.error) {
      if (!isMissingLeaderboardSchemaError(teamRegistrationResult.error)) {
        throw teamRegistrationResult.error;
      }
    } else if ((teamRegistrationResult.data ?? []).length > 0) {
      return true;
    }
  }

  const attemptResult = await supabase
    .from("competition_attempts")
    .select("id, competition_registrations!inner(profile_id, team_id)")
    .eq("competition_id", competitionId)
    .limit(20);

  if (attemptResult.error) {
    if (isMissingLeaderboardSchemaError(attemptResult.error)) {
      return false;
    }

    throw attemptResult.error;
  }

  return (attemptResult.data ?? []).some((row) => {
    const registrations = Array.isArray(row.competition_registrations)
      ? row.competition_registrations
      : row.competition_registrations
        ? [row.competition_registrations]
        : [];

    return registrations.some((registration) => {
      if (!registration || typeof registration !== "object") {
        return false;
      }

      const profile = (registration as { profile_id?: unknown }).profile_id;
      if (typeof profile === "string" && profile === profileId) {
        return true;
      }

      const team = (registration as { team_id?: unknown }).team_id;
      return typeof team === "string" && teamIds.includes(team);
    });
  });
}

export async function listCompetitionLeaderboardEntries(input: {
  supabase?: ServerSupabaseClient;
  competitionId: string;
}): Promise<LeaderboardEntry[]> {
  const supabase = input.supabase ?? (await createClient());
  const { data, error } = await supabase
    .from("leaderboard_entries")
    .select(LEADERBOARD_ENTRY_SELECT_COLUMNS)
    .eq("competition_id", input.competitionId)
    .order("rank", { ascending: true })
    .order("computed_at", { ascending: false })
    .returns<LeaderboardEntryRow[]>();

  if (error) {
    if (isMissingLeaderboardSchemaError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? [])
    .map((row) => normalizeLeaderboardEntry(row))
    .filter((row): row is LeaderboardEntry => row !== null);
}

export async function loadMathleteCompetitionLeaderboard(input: {
  competitionId: string;
  profileId: string;
}): Promise<CompetitionLeaderboardView> {
  const supabase = await createClient();
  const competition = await fetchCompetitionById(supabase, input.competitionId);
  const hasParticipantContext = await resolveParticipantContext(
    supabase,
    input.competitionId,
    input.profileId,
  );
  const visibility = canParticipantViewLeaderboard({
    competition,
    hasParticipantContext,
  });

  if (!competition || !visibility.canView) {
    return {
      competition,
      entries: [],
      hasParticipantContext,
      canView: visibility.canView,
      reason: visibility.reason,
    };
  }

  const entries = await listCompetitionLeaderboardEntries({
    supabase,
    competitionId: competition.id,
  });

  return {
    competition,
    entries,
    hasParticipantContext,
    canView: visibility.canView,
    reason: visibility.reason,
  };
}

export async function loadOrganizerCompetitionLeaderboard(input: {
  competitionId: string;
  organizerId: string;
}): Promise<{ competition: CompetitionRecord | null; entries: LeaderboardEntry[] }> {
  const supabase = await createClient();
  const competition = await fetchCompetitionById(supabase, input.competitionId);

  if (!competition || competition.organizerId !== input.organizerId || competition.isDeleted) {
    return { competition: null, entries: [] };
  }

  const entries = await listCompetitionLeaderboardEntries({
    supabase,
    competitionId: input.competitionId,
  });

  return { competition, entries };
}

export async function fetchCompetitionByIdWithLeaderboardFallback(input: {
  competitionId: string;
}): Promise<CompetitionRecord | null> {
  const supabase = await createClient();
  return fetchCompetitionById(supabase, input.competitionId);
}

export function isLeaderboardCompatibilityError(error: unknown): boolean {
  const candidate = error as SupabaseError | null | undefined;
  return isMissingLeaderboardSchemaError(candidate);
}
