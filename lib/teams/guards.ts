import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamMembershipRow = {
  id: string;
  team_id: string;
  profile_id: string;
  role: string;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
};

export type TeamRow = {
  id: string;
  name: string;
  team_code: string;
  created_by: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

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

export async function fetchActiveMembership(
  admin: SupabaseClient,
  teamId: string,
  profileId: string,
) {
  const { data, error } = await admin
    .from("team_memberships")
    .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
    .eq("team_id", teamId)
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .maybeSingle<TeamMembershipRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchTeamById(admin: SupabaseClient, teamId: string) {
  const { data, error } = await admin
    .from("teams")
    .select(
      "id, name, team_code, created_by, is_archived, created_at, updated_at",
    )
    .eq("id", teamId)
    .maybeSingle<TeamRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchTeamByCode(admin: SupabaseClient, teamCode: string) {
  const { data, error } = await admin
    .from("teams")
    .select(
      "id, name, team_code, created_by, is_archived, created_at, updated_at",
    )
    .eq("team_code", teamCode)
    .maybeSingle<TeamRow>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchTeamMembers(admin: SupabaseClient, teamId: string) {
  const { data, error } = await admin
    .from("team_memberships")
    .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
    .eq("team_id", teamId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function isTeamLeader(
  admin: SupabaseClient,
  teamId: string,
  profileId: string,
) {
  const membership = await fetchActiveMembership(admin, teamId, profileId);
  return membership?.role === "leader";
}

export async function getTeamRosterLock(
  admin: SupabaseClient,
  teamId: string,
): Promise<{ locked: boolean; competitionId: string | null }> {
  const { data, error } = await admin
    .from("competition_registrations")
    .select("competition_id, competitions(status, format, type)")
    .eq("team_id", teamId)
    .eq("status", "registered");

  if (error) {
    if (isMissingRegistrationSchema(error)) {
      return { locked: false, competitionId: null };
    }

    throw error;
  }

  const lock = (data ?? []).find((row) => {
    const competition = row.competitions as
      | { status?: string | null; format?: string | null; type?: string | null }
      | null
      | undefined;

    if (!competition) {
      return false;
    }

    const status = competition.status ?? "";

    return (
      competition.format === "team" &&
      competition.type === "scheduled" &&
      status !== "ended" &&
      status !== "archived"
    );
  });

  return {
    locked: Boolean(lock),
    competitionId: lock?.competition_id ?? null,
  };
}

export async function hasTeamRegistrationConflict(
  admin: SupabaseClient,
  teamId: string,
  profileId: string,
): Promise<{ conflict: boolean; competitionId: string | null }> {
  const { data: teamRegistrations, error: teamRegError } = await admin
    .from("competition_registrations")
    .select("competition_id, competitions(status, format, type)")
    .eq("team_id", teamId)
    .eq("status", "registered");

  if (teamRegError) {
    if (isMissingRegistrationSchema(teamRegError)) {
      return { conflict: false, competitionId: null };
    }

    throw teamRegError;
  }

  const activeCompetitionIds = (teamRegistrations ?? [])
    .filter((row) => {
      const competition = row.competitions as
        | { status?: string | null; format?: string | null; type?: string | null }
        | null
        | undefined;

      if (!competition) {
        return false;
      }

      const status = competition.status ?? "";

      return (
        competition.format === "team" &&
        competition.type === "scheduled" &&
        status !== "ended" &&
        status !== "archived"
      );
    })
    .map((row) => row.competition_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (activeCompetitionIds.length === 0) {
    return { conflict: false, competitionId: null };
  }

  const { data: memberTeams, error: memberTeamsError } = await admin
    .from("team_memberships")
    .select("team_id")
    .eq("profile_id", profileId)
    .eq("is_active", true)
    .neq("team_id", teamId);

  if (memberTeamsError) {
    throw memberTeamsError;
  }

  const teamIds = (memberTeams ?? [])
    .map((row) => row.team_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (teamIds.length === 0) {
    return { conflict: false, competitionId: null };
  }

  const { data: conflicts, error: conflictError } = await admin
    .from("competition_registrations")
    .select("competition_id")
    .in("team_id", teamIds)
    .in("competition_id", activeCompetitionIds)
    .eq("status", "registered")
    .limit(1);

  if (conflictError) {
    if (isMissingRegistrationSchema(conflictError)) {
      return { conflict: false, competitionId: null };
    }

    throw conflictError;
  }

  if (!conflicts || conflicts.length === 0) {
    return { conflict: false, competitionId: null };
  }

  const competitionId =
    typeof conflicts[0]?.competition_id === "string"
      ? conflicts[0]?.competition_id
      : null;

  return { conflict: true, competitionId };
}
