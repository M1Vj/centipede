import { createAdminClient } from "@/lib/supabase/admin";

export interface OffenseLog {
  id: string;
  offense_number: number;
  penalty_applied: string;
  logged_at: string;
  client_timestamp: string | null;
  metadata_json: Record<string, unknown>;
  competition_attempts: {
    competition_registrations: {
      profile_id: string | null;
      team_id: string | null;
      profiles: { full_name: string } | null;
      teams: { name: string } | null;
    } | null;
  } | null;
}

type CompetitionOwnershipRow = {
  id: string;
  organizer_id: string | null;
};

type CompetitionAttemptRow = {
  id: string;
  registration_id: string;
};

type CompetitionRegistrationRow = {
  id: string;
  profile_id: string | null;
  team_id: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type TeamRow = {
  id: string;
  name: string | null;
};

type OffenseLogRow = OffenseLog & {
  attempt_id: string;
};

function logOffenseQueryError(stage: string, error: { code?: string | null; message?: string | null; details?: string | null }) {
  console.error(`Error fetching offense logs during ${stage}:`, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
  });
}

export async function getCompetitionOffenses(
  competitionId: string,
  organizerId: string,
): Promise<OffenseLog[]> {
  const admin = createAdminClient();
  if (!admin || !organizerId) {
    return [];
  }

  const ownershipResult = await admin
    .from("competitions")
    .select("id, organizer_id")
    .eq("id", competitionId)
    .maybeSingle<CompetitionOwnershipRow>();

  if (ownershipResult.error) {
    logOffenseQueryError("competition ownership lookup", ownershipResult.error);
    return [];
  }

  if (!ownershipResult.data || ownershipResult.data.organizer_id !== organizerId) {
    return [];
  }

  const attemptsResult = await admin
    .from("competition_attempts")
    .select("id, registration_id")
    .eq("competition_id", competitionId)
    .order("started_at", { ascending: false });

  if (attemptsResult.error) {
    logOffenseQueryError("attempt lookup", attemptsResult.error);
    return [];
  }

  const attempts = (attemptsResult.data ?? []) as CompetitionAttemptRow[];
  if (attempts.length === 0) {
    return [];
  }

  const attemptIds = attempts.map((attempt) => attempt.id);
  const logsResult = await admin
    .from("tab_switch_logs")
    .select("id, attempt_id, offense_number, penalty_applied, logged_at, client_timestamp, metadata_json")
    .in("attempt_id", attemptIds)
    .order("logged_at", { ascending: false });

  if (logsResult.error) {
    logOffenseQueryError("log lookup", logsResult.error);
    return [];
  }

  const logs = (logsResult.data ?? []) as OffenseLogRow[];
  if (logs.length === 0) {
    return [];
  }

  const registrationIds = [...new Set(attempts.map((attempt) => attempt.registration_id))];
  const registrationsResult = await admin
    .from("competition_registrations")
    .select("id, profile_id, team_id")
    .in("id", registrationIds);

  if (registrationsResult.error) {
    logOffenseQueryError("registration lookup", registrationsResult.error);
    return [];
  }

  const registrations = (registrationsResult.data ?? []) as CompetitionRegistrationRow[];
  const profileIds = [...new Set(registrations.map((registration) => registration.profile_id).filter((id): id is string => Boolean(id)))];
  const teamIds = [...new Set(registrations.map((registration) => registration.team_id).filter((id): id is string => Boolean(id)))];

  const [profilesResult, teamsResult] = await Promise.all([
    profileIds.length > 0
      ? admin.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length > 0
      ? admin.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error) {
    logOffenseQueryError("profile lookup", profilesResult.error);
    return [];
  }

  if (teamsResult.error) {
    logOffenseQueryError("team lookup", teamsResult.error);
    return [];
  }

  const registrationsById = new Map(registrations.map((registration) => [registration.id, registration]));
  const profilesById = new Map(((profilesResult.data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const teamsById = new Map(((teamsResult.data ?? []) as TeamRow[]).map((team) => [team.id, team]));
  const attemptsById = new Map(attempts.map((attempt) => [attempt.id, attempt]));

  return logs.map((log) => {
    const attempt = attemptsById.get(log.attempt_id);
    const registration = attempt ? registrationsById.get(attempt.registration_id) ?? null : null;
    const profile = registration?.profile_id ? profilesById.get(registration.profile_id) ?? null : null;
    const team = registration?.team_id ? teamsById.get(registration.team_id) ?? null : null;

    return {
      id: log.id,
      offense_number: log.offense_number,
      penalty_applied: log.penalty_applied,
      logged_at: log.logged_at,
      client_timestamp: log.client_timestamp,
      metadata_json: log.metadata_json,
      competition_attempts: registration
        ? {
            competition_registrations: {
              profile_id: registration.profile_id,
              team_id: registration.team_id,
              profiles: profile ? { full_name: profile.full_name ?? "" } : null,
              teams: team ? { name: team.name ?? "" } : null,
            },
          }
        : null,
    };
  });
}
