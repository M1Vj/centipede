"use server";

import { createClient } from "@/lib/supabase/server";
import {
  COMPETITION_SELECT_COLUMNS,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import type {
  RegistrationDetail,
  OrganizerRegistrationDetail,
  RegistrationRow,
  RegistrationRpcResult,
  RegistrationStatus,
  RegistrationSummary,
  TeamRegistrationValidationResult,
  WithdrawRegistrationResult,
} from "@/lib/registrations/types";
import {
  ORGANIZER_REGISTRATION_FALLBACK_SELECT_COLUMNS,
  ORGANIZER_REGISTRATION_SELECT_COLUMNS,
  normalizeOrganizerRegistrationRow,
  type OrganizerRegistrationSourceRow,
} from "@/lib/registrations/organizer";

const REGISTRATION_SELECT_COLUMNS =
  "id, competition_id, profile_id, team_id, status, status_reason, entry_snapshot_json, registered_at, updated_at";

const REGISTRATION_SUMMARY_COLUMNS =
  "id, competition_id, team_id, status, status_reason";

const REGISTRATION_DETAIL_COLUMNS =
  "id, competition_id, team_id, status, status_reason, registered_at, updated_at";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

function extractRpcRow<T>(data: T[] | T | null | undefined) {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data;
}

function isMissingRegistrationRpc(error: SupabaseError | null | undefined, name: string) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42883" || message.includes(name);
}

function isMissingRegistrationTable(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("competition_registrations")
  );
}

function isMissingRegistrationEmbed(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "PGRST200" ||
    error.code === "PGRST201" ||
    message.includes("relationship") ||
    message.includes("profiles") ||
    message.includes("teams")
  );
}

export async function registerForCompetition(input: {
  competitionId: string;
  teamId?: string | null;
  requestIdempotencyToken: string;
}): Promise<RegistrationRpcResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("register_for_competition", {
    p_competition_id: input.competitionId,
    p_team_id: input.teamId ?? null,
    p_request_idempotency_token: input.requestIdempotencyToken,
  });

  if (error) {
    if (isMissingRegistrationRpc(error as SupabaseError, "register_for_competition")) {
      return {
        machine_code: "deferred_owner_schema",
        registration_id: null,
        status: null,
        status_reason: null,
        entry_snapshot_json: null,
        replayed: false,
        changed: false,
      };
    }

    throw new Error(error.message);
  }

  return (
    extractRpcRow<RegistrationRpcResult>(data) ?? {
      machine_code: "unknown_response",
      registration_id: null,
      status: null,
      status_reason: null,
      entry_snapshot_json: null,
      replayed: false,
      changed: false,
    }
  );
}

export async function withdrawRegistration(input: {
  registrationId: string;
  statusReason: string;
  requestIdempotencyToken: string;
}): Promise<WithdrawRegistrationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("withdraw_registration", {
    p_registration_id: input.registrationId,
    p_status_reason: input.statusReason,
    p_request_idempotency_token: input.requestIdempotencyToken,
  });

  if (error) {
    if (isMissingRegistrationRpc(error as SupabaseError, "withdraw_registration")) {
      return {
        machine_code: "deferred_owner_schema",
        registration_id: null,
        status: null,
        status_reason: null,
        replayed: false,
        changed: false,
      };
    }

    throw new Error(error.message);
  }

  return (
    extractRpcRow<WithdrawRegistrationResult>(data) ?? {
      machine_code: "unknown_response",
      registration_id: null,
      status: null,
      status_reason: null,
      replayed: false,
      changed: false,
    }
  );
}

export async function validateTeamRegistration(input: {
  teamId: string;
  competitionId: string;
}): Promise<TeamRegistrationValidationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabase.rpc("validate_team_registration", {
    p_team_id: input.teamId,
    p_competition_id: input.competitionId,
  });

  if (error) {
    if (isMissingRegistrationRpc(error as SupabaseError, "validate_team_registration")) {
      return {
        machine_code: "deferred_owner_schema",
        team_id: null,
        competition_id: null,
        roster_count: null,
        required_count: null,
        conflict: false,
        eligible: false,
      };
    }

    throw new Error(error.message);
  }

  return (
    extractRpcRow<TeamRegistrationValidationResult>(data) ?? {
      machine_code: "unknown_response",
      team_id: null,
      competition_id: null,
      roster_count: null,
      required_count: null,
      conflict: false,
      eligible: false,
    }
  );
}

export async function fetchRegistrationForCompetition(input: {
  competitionId: string;
  teamId?: string | null;
  profileId?: string | null;
}): Promise<RegistrationRow | null> {
  const supabase = await createClient();
  const query = supabase
    .from("competition_registrations")
    .select(REGISTRATION_SELECT_COLUMNS)
    .eq("competition_id", input.competitionId);

  if (input.teamId) {
    query.eq("team_id", input.teamId);
  }

  if (input.profileId) {
    query.eq("profile_id", input.profileId);
  }

  const { data, error } = await query.maybeSingle<RegistrationRow>();

  if (error) {
    if (isMissingRegistrationTable(error as SupabaseError)) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ?? null;
}

export async function listMyRegistrations(input: {
  statuses?: RegistrationStatus[];
  competitionId?: string;
} = {}): Promise<RegistrationSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const query = supabase
    .from("competition_registrations")
    .select(REGISTRATION_SUMMARY_COLUMNS)
    .order("registered_at", { ascending: false });

  if (input.statuses?.length) {
    query.in("status", input.statuses);
  }

  if (input.competitionId) {
    query.eq("competition_id", input.competitionId);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRegistrationTable(error as SupabaseError)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as RegistrationSummary[];
}

export async function listMyRegistrationDetails(input: {
  statuses?: RegistrationStatus[];
  limit?: number;
} = {}): Promise<RegistrationDetail[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const query = supabase
    .from("competition_registrations")
    .select(REGISTRATION_DETAIL_COLUMNS)
    .order("registered_at", { ascending: false });

  if (input.statuses?.length) {
    query.in("status", input.statuses);
  }

  if (input.limit && input.limit > 0) {
    query.limit(input.limit);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingRegistrationTable(error as SupabaseError)) {
      return [];
    }

    throw new Error(error.message);
  }

  const registrations = (data ?? []) as Array<RegistrationSummary & {
    registered_at?: string | null;
    updated_at?: string | null;
  }>;
  const competitionIds = Array.from(
    new Set(
      registrations
        .map((registration) => registration.competition_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  const competitionsById = new Map<string, CompetitionRecord>();
  if (competitionIds.length > 0) {
    const competitionsResult = await supabase
      .from("competitions")
      .select(COMPETITION_SELECT_COLUMNS)
      .in("id", competitionIds);

    if (!competitionsResult.error) {
      (competitionsResult.data ?? [])
        .map((row) => normalizeCompetitionRecord(row))
        .filter((row): row is CompetitionRecord => row !== null)
        .forEach((competition) => {
          competitionsById.set(competition.id, competition);
        });
    } else if (!isMissingRegistrationTable(competitionsResult.error as SupabaseError)) {
      throw new Error(competitionsResult.error.message);
    }
  }

  return registrations.map((registration) => {
    const competition = competitionsById.get(registration.competition_id) ?? null;

    return {
      id: registration.id,
      competition_id: registration.competition_id,
      team_id: registration.team_id ?? null,
      status: registration.status ?? null,
      status_reason: registration.status_reason ?? null,
      registered_at: registration.registered_at ?? null,
      updated_at: registration.updated_at ?? null,
      competition: competition
        ? {
            id: competition.id,
            name: competition.name,
            type: competition.type,
            format: competition.format,
            status: competition.status,
            startTime: competition.startTime,
            endTime: competition.endTime,
            registrationStart: competition.registrationStart,
          }
        : null,
    };
  });
}

export async function listOrganizerCompetitionRegistrations(input: {
  competitionId: string;
}): Promise<OrganizerRegistrationDetail[]> {
  const supabase = await createClient();
  const query = supabase
    .from("competition_registrations")
    .select(ORGANIZER_REGISTRATION_SELECT_COLUMNS)
    .eq("competition_id", input.competitionId)
    .order("registered_at", { ascending: false });

  const { data, error } = await query;

  if (error) {
    if (isMissingRegistrationEmbed(error as SupabaseError)) {
      const fallbackResult = await supabase
        .from("competition_registrations")
        .select(ORGANIZER_REGISTRATION_FALLBACK_SELECT_COLUMNS)
        .eq("competition_id", input.competitionId)
        .order("registered_at", { ascending: false });

      if (fallbackResult.error) {
        if (isMissingRegistrationTable(fallbackResult.error as SupabaseError)) {
          return [];
        }

        throw new Error(fallbackResult.error.message);
      }

      return ((fallbackResult.data ?? []) as OrganizerRegistrationSourceRow[])
        .map((row) => normalizeOrganizerRegistrationRow(row))
        .filter((row): row is OrganizerRegistrationDetail => row !== null);
    }

    if (isMissingRegistrationTable(error as SupabaseError)) {
      return [];
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as OrganizerRegistrationSourceRow[])
    .map((row) => normalizeOrganizerRegistrationRow(row))
    .filter((row): row is OrganizerRegistrationDetail => row !== null);
}

export async function fetchTeamRegistrations(input: {
  competitionId: string;
  teamIds: string[];
}): Promise<RegistrationSummary[]> {
  if (input.teamIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const query = supabase
    .from("competition_registrations")
    .select(REGISTRATION_SUMMARY_COLUMNS)
    .eq("competition_id", input.competitionId)
    .in("team_id", input.teamIds);

  const { data, error } = await query;

  if (error) {
    if (isMissingRegistrationTable(error as SupabaseError)) {
      return [];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as RegistrationSummary[];
}
