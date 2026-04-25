import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  mapDatabaseError,
  type ProblemBankActorRole,
} from "@/lib/problem-bank/api-helpers";
import {
  buildCompetitionDraftRpcPayload,
  buildLegacyCompetitionMutationPayload,
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionLifecycleResult, CompetitionRecord } from "@/lib/competition/types";

export { buildCompetitionDraftRpcPayload, buildLegacyCompetitionMutationPayload };

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ActorProfileRow = {
  id: string;
  role: string;
  is_active: boolean | null;
};

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      code,
      message,
      ...(details ?? {}),
    },
    { status },
  );
}

export function jsonOk(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

export function withCompetitionStatus<T extends { status: string }>(competition: T, status: T["status"]) {
  return {
    ...competition,
    status,
  };
}

export function jsonDatabaseError(error: unknown) {
  const mapped = mapDatabaseError(error);
  return jsonError(mapped.code, mapped.message, mapped.status);
}

export function requireSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  let normalizedOriginHost = "";
  try {
    normalizedOriginHost = new URL(origin).host;
  } catch {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  if (normalizedOriginHost !== host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  return null;
}

export function getRequestIdempotencyToken(request: Request) {
  return (
    request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key") ?? ""
  ).trim();
}

export function competitionLifecycleErrorStatus(machineCode: string) {
  if (
    machineCode === "invalid_transition" ||
    machineCode === "draft_write_conflict" ||
    machineCode === "no_problems_selected" ||
    machineCode === "problem_count_out_of_range" ||
    machineCode === "snapshot_incomplete" ||
    machineCode === "snapshot_failed" ||
    machineCode === "archive_requires_no_active_attempts" ||
    machineCode === "archive_requires_open_paused_competition" ||
    machineCode === "open_requires_trusted_manual_action" ||
    machineCode === "scheduled_requires_system_timer" ||
    machineCode === "reason_required" ||
    machineCode === "request_idempotency_token_required" ||
    machineCode === "draft_only_delete" ||
    machineCode === "competition_publish_requires_scoring_snapshot" ||
    machineCode === "competition_publish_snapshot_mismatch" ||
    machineCode === "competition_publish_requires_snapshot" ||
    machineCode === "has_active_registrations" ||
    machineCode === "has_attempt_history"
  ) {
    return 409;
  }

  if (machineCode === "forbidden") {
    return 403;
  }

  if (machineCode === "not_found" || machineCode === "deleted") {
    return 404;
  }

  return 400;
}

export function competitionLifecycleErrorMessage(machineCode: string) {
  switch (machineCode) {
    case "draft_write_conflict":
      return "Draft changed elsewhere. Refresh and try again.";
    case "invalid_transition":
      return "Competition is not in correct state for this action.";
    case "no_problems_selected":
      return "Select at least 10 problems before publish.";
    case "problem_count_out_of_range":
      return "Publish requires selecting between 10 and 100 problems.";
    case "snapshot_incomplete":
      return "Publish snapshot is incomplete. Refresh problem selections and try again.";
    case "snapshot_failed":
      return "Unable to snapshot selected problems for publish.";
    case "archive_requires_no_active_attempts":
      return "Archive requires no active attempts.";
    case "archive_requires_open_paused_competition":
      return "Only paused open competitions can be archived.";
    case "open_requires_trusted_manual_action":
      return "Open competitions require trusted manual action.";
    case "scheduled_requires_system_timer":
      return "Scheduled competitions can only end from the server timer.";
    case "reason_required":
      return "Reason is required for this transition.";
    case "request_idempotency_token_required":
      return "Request idempotency token is required.";
    case "draft_only_delete":
      return "Only draft competitions can be deleted.";
    case "has_active_registrations":
      return "Competition still has active registrations.";
    case "has_attempt_history":
      return "Competition already has attempt history.";
    case "competition_publish_requires_scoring_snapshot":
      return "Scoring snapshot is not ready yet.";
    case "competition_publish_snapshot_mismatch":
      return "Competition snapshot changed during publish.";
    case "competition_publish_requires_snapshot":
      return "Competition problems must be snapshotted before publish.";
    case "forbidden":
      return "You do not have permission for this operation.";
    case "deleted":
      return "Competition already deleted.";
    case "not_found":
      return "Requested resource was not found.";
    default:
      return "Competition action failed.";
  }
}

export function normalizeLifecycleOutcome(result: CompetitionLifecycleResult | null) {
  if (!result) {
    return null;
  }

  return {
    machineCode: result.machineCode,
    status: result.status ?? result.currentStatus ?? null,
    eventId: result.eventId,
    replayed: result.replayed,
    changed: result.changed,
    requestIdempotencyToken: result.requestIdempotencyToken,
    draftRevision: result.draftRevision ?? result.currentDraftRevision ?? null,
    selectedProblemCount: result.selectedProblemCount ?? null,
  } as const;
}

export function isLegacyCompetitionSchemaError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "22P02" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    error.code === "PGRST204" ||
    message.includes("does not exist") ||
    message.includes("could not find")
  );
}

export async function replaceCompetitionProblemsLegacy(
  adminClient: AdminSupabaseClient,
  competitionId: string,
  selectedProblemIds: string[],
) {
  const deleteResult = await adminClient.from("competition_problems").delete().eq("competition_id", competitionId);
  if (deleteResult.error) {
    return { error: deleteResult.error } as const;
  }

  if (selectedProblemIds.length === 0) {
    return { selectedProblemCount: 0 } as const;
  }

  const rows = selectedProblemIds.map((problemId, index) => ({
    competition_id: competitionId,
    problem_id: problemId,
    order_index: index + 1,
    points: null,
  }));

  const insertResult = await adminClient.from("competition_problems").insert(rows);
  if (insertResult.error) {
    return { error: insertResult.error } as const;
  }

  const { count, error: countError } = await adminClient
    .from("competition_problems")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);

  if (countError) {
    return { error: countError } as const;
  }

  return { selectedProblemCount: count ?? selectedProblemIds.length } as const;
}

export async function validateCompetitionProblemSelection(
  supabase: ServerSupabaseClient,
  problemIds: string[],
) {
  const selectedProblemIds = problemIds.filter((problemId) => typeof problemId === "string" && problemId.trim());
  if (selectedProblemIds.length === 0) {
    return {
      selectedProblemIds: [] as string[],
      missingProblemIds: [] as string[],
    } as const;
  }

  const { data, error } = await supabase
    .from("problems")
    .select("id")
    .in("id", selectedProblemIds)
    .eq("is_deleted", false);

  if (error) {
    return {
      response: jsonDatabaseError(error),
    } as const;
  }

  const accessibleIds = new Set((data ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string"));
  const missingProblemIds = selectedProblemIds.filter((problemId) => !accessibleIds.has(problemId));

  return {
    selectedProblemIds,
    missingProblemIds,
  } as const;
}

export async function requireOrganizerCompetitionActor(): Promise<
  | {
      supabase: ServerSupabaseClient;
      actor: {
        userId: string;
        role: ProblemBankActorRole;
        isActive: boolean;
      };
    }
  | {
      response: NextResponse;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: jsonError("unauthorized", "Authentication is required.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<ActorProfileRow>();

  if (profileError) {
    return {
      response: jsonError("auth_context_failed", "Unable to resolve actor context.", 500),
    };
  }

  if (!profile || profile.is_active === false) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  if (profile.role !== "organizer") {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  return {
    supabase,
    actor: {
      userId: profile.id,
      role: profile.role as ProblemBankActorRole,
      isActive: true,
    },
  };
}

export async function fetchCompetition(
  supabase: ServerSupabaseClient,
  competitionId: string,
  organizerId: string,
): Promise<
  | { competition: CompetitionRecord }
  | { response: NextResponse }
> {
  const primaryResult = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .eq("organizer_id", organizerId)
    .maybeSingle();

  const primaryCompetition = normalizeCompetitionRecord(primaryResult.data);
  const shouldTryLegacyRead =
    !primaryCompetition || (primaryResult.error && isLegacyCompetitionSelectError(primaryResult.error));

  if (shouldTryLegacyRead) {
    const fallbackResult = await supabase
      .from("competitions")
      .select(LEGACY_COMPETITION_SELECT_COLUMNS)
      .eq("id", competitionId)
      .eq("organizer_id", organizerId)
      .maybeSingle();

    if (fallbackResult.error) {
      if (
        isLegacyCompetitionSelectError(primaryResult.error) ||
        isLegacyCompetitionSelectError(fallbackResult.error)
      ) {
        return {
          response: jsonError(
            "service_unavailable",
            "Competition data is temporarily unavailable while database migrations are incomplete.",
            503,
          ),
        };
      }

      return {
        response: jsonDatabaseError(fallbackResult.error),
      };
    }

    const fallbackCompetition = normalizeCompetitionRecord(fallbackResult.data);
    if (fallbackCompetition) {
      return { competition: fallbackCompetition };
    }

    if (
      isLegacyCompetitionSelectError(primaryResult.error) ||
      isLegacyCompetitionSelectError(fallbackResult.error)
    ) {
      return {
        response: jsonError(
          "service_unavailable",
          "Competition data is temporarily unavailable while database migrations are incomplete.",
          503,
        ),
      };
    }
  }

  if (primaryResult.error) {
    return {
      response: jsonDatabaseError(primaryResult.error),
    };
  }

  if (!primaryCompetition) {
    return {
      response: jsonError("not_found", "Requested resource was not found.", 404),
    };
  }

  return { competition: primaryCompetition };
}

export function requireCompetitionAdminClient() {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      response: jsonError(
        "service_unavailable",
        "Competition mutations are temporarily unavailable.",
        503,
      ),
    } as const;
  }

  return { adminClient: adminClient as AdminSupabaseClient } as const;
}
/*
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  mapDatabaseError,
  type ProblemBankActorRole,
} from "@/lib/problem-bank/api-helpers";
import {
  normalizeCompetitionRecord,
  COMPETITION_SELECT_COLUMNS,
  type CompetitionRecord,
} from "@/lib/competition/api";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>;

type ActorProfileRow = {
  id: string;
  role: string;
  is_active: boolean | null;
};

export function jsonError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      code,
      message,
      ...(details ?? {}),
    },
    { status },
  );
}

export function jsonOk(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, { status });
}

export function jsonDatabaseError(error: unknown) {
  const mapped = mapDatabaseError(error);
  return jsonError(mapped.code, mapped.message, mapped.status);
}

export function requireSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  let normalizedOriginHost = "";
  try {
    normalizedOriginHost = new URL(origin).host;
  } catch {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  if (normalizedOriginHost !== host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  return null;
}

export async function requireOrganizerCompetitionActor(): Promise<
  | {
      supabase: ServerSupabaseClient;
      actor: {
        userId: string;
        role: ProblemBankActorRole;
        isActive: boolean;
      };
    }
  | {
      response: NextResponse;
    }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: jsonError("unauthorized", "Authentication is required.", 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<ActorProfileRow>();

  if (profileError) {
    return {
      response: jsonError("auth_context_failed", "Unable to resolve actor context.", 500),
    };
  }

  if (!profile || profile.is_active === false) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  if (profile.role !== "organizer") {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    };
  }

  return {
    supabase,
    actor: {
      userId: profile.id,
      role: profile.role as ProblemBankActorRole,
      isActive: true,
    },
  };
}

export async function fetchCompetition(
  supabase: ServerSupabaseClient,
  competitionId: string,
  organizerId: string,
): Promise<
  | { competition: CompetitionRecord }
  | { response: NextResponse }
> {
  const { data, error } = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .eq("organizer_id", organizerId)
    .maybeSingle();

  if (error) {
    return {
      response: jsonDatabaseError(error),
    };
  }

  const competition = normalizeCompetitionRecord(data);
  if (!competition) {
    return {
      response: jsonError("not_found", "Requested resource was not found.", 404),
    };
  }

  return { competition };
}

export function requireCompetitionAdminClient() {
  const adminClient = createAdminClient();
  if (!adminClient) {
    return {
      response: jsonError(
        "service_unavailable",
        "Competition mutations are temporarily unavailable.",
        503,
      ),
    } as const;
  }

  return { adminClient: adminClient as AdminSupabaseClient } as const;
}
*/
