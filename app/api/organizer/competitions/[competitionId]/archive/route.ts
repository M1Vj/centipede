import { normalizeCompetitionLifecycleResult } from "@/lib/competition/api";
import {
  competitionLifecycleErrorMessage,
  competitionLifecycleErrorStatus,
  fetchCompetition,
  getRequestIdempotencyToken,
  isLegacyCompetitionSchemaError,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  normalizeLifecycleOutcome,
  requireCompetitionAdminClient,
  requireOrganizerCompetitionActor,
  requireSameOriginMutation,
} from "../../_shared";

export async function POST(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const requestIdempotencyToken = getRequestIdempotencyToken(request);
  if (!requestIdempotencyToken) {
    return jsonError("request_idempotency_token_required", "Request idempotency token is required.", 400);
  }

  const auth = await requireOrganizerCompetitionActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, actor } = auth;
  const { competitionId } = await context.params;
  const competitionResult = await fetchCompetition(supabase, competitionId, actor.userId);

  if ("response" in competitionResult) {
    return competitionResult.response;
  }

  const { competition } = competitionResult;
  if (competition.isDeleted) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const adminClientResult = requireCompetitionAdminClient();
  if ("response" in adminClientResult) {
    return adminClientResult.response;
  }

  const { adminClient } = adminClientResult;
  const { data, error } = await adminClient.rpc("archive_competition", {
    p_competition_id: competitionId,
    p_request_idempotency_token: requestIdempotencyToken,
  });

  if (error && isLegacyCompetitionSchemaError(error)) {
    if (!(competition.status === "ended" || competition.status === "paused")) {
      return jsonError(
        "invalid_transition",
        competitionLifecycleErrorMessage("invalid_transition"),
        competitionLifecycleErrorStatus("invalid_transition"),
        {
          currentStatus: competition.status,
        },
      );
    }

    if (competition.status === "paused" && competition.type !== "open") {
      return jsonError(
        "archive_requires_open_paused_competition",
        competitionLifecycleErrorMessage("archive_requires_open_paused_competition"),
        competitionLifecycleErrorStatus("archive_requires_open_paused_competition"),
        {
          currentStatus: competition.status,
        },
      );
    }

    const fallbackUpdate = await adminClient
      .from("competitions")
      .update({
        status: "archived",
        published: true,
        is_paused: false,
      })
      .eq("id", competitionId)
      .eq("organizer_id", actor.userId)
      .select("id")
      .maybeSingle();

    if (fallbackUpdate.error && isLegacyCompetitionSchemaError(fallbackUpdate.error)) {
      return jsonError(
        "service_unavailable",
        "Competition lifecycle mutations are temporarily unavailable while database migrations are incomplete.",
        503,
        {
          currentStatus: competition.status,
          replayed: false,
          changed: false,
        },
      );
    }

    if (fallbackUpdate.error) {
      return jsonDatabaseError(fallbackUpdate.error);
    }

    if (!fallbackUpdate.data) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
    if ("response" in refreshed) {
      return refreshed.response;
    }

    return jsonOk({
      code: "ok",
      competition: refreshed.competition,
      lifecycle: {
        machineCode: "ok",
        status: refreshed.competition.status,
        eventId: null,
        replayed: false,
        changed: true,
        requestIdempotencyToken,
        draftRevision: refreshed.competition.draftRevision,
        selectedProblemCount: null,
      },
    });
  }

  if (error) {
    return jsonDatabaseError(error);
  }

  const lifecycleResult = normalizeLifecycleOutcome(normalizeCompetitionLifecycleResult(data));
  if (!lifecycleResult) {
    return jsonError("operation_failed", "Competition archive failed.", 500);
  }

  if (lifecycleResult.machineCode !== "ok") {
    return jsonError(
      lifecycleResult.machineCode,
      competitionLifecycleErrorMessage(lifecycleResult.machineCode),
      competitionLifecycleErrorStatus(lifecycleResult.machineCode),
      {
        status: lifecycleResult.status,
        replayed: lifecycleResult.replayed,
        changed: lifecycleResult.changed,
      },
    );
  }

  const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
  if ("response" in refreshed) {
    return refreshed.response;
  }

  return jsonOk({
    code: "ok",
    competition: refreshed.competition,
    lifecycle: lifecycleResult,
  });
}
