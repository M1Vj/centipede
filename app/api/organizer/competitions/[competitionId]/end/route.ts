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

  if (competition.type !== "open") {
    return jsonError("invalid_transition", "Only open competitions can be ended manually.", 409, {
      currentType: competition.type,
      currentStatus: competition.status,
    });
  }

  const adminClientResult = requireCompetitionAdminClient();
  if ("response" in adminClientResult) {
    return adminClientResult.response;
  }

  const { adminClient } = adminClientResult;
  const { data, error } = await adminClient.rpc("end_competition", {
    p_competition_id: competitionId,
    p_request_idempotency_token: requestIdempotencyToken,
    p_reason: "manual",
    p_transition_source: "trusted_manual_action",
  });

  if (error && isLegacyCompetitionSchemaError(error)) {
    if (!(
      competition.status === "live" ||
      competition.status === "paused" ||
      competition.status === "published"
    )) {
      return jsonError(
        "invalid_transition",
        competitionLifecycleErrorMessage("invalid_transition"),
        competitionLifecycleErrorStatus("invalid_transition"),
        {
          currentStatus: competition.status,
        },
      );
    }

    return jsonOk({
      code: "ok",
      competition: {
        ...competition,
        status: "ended",
      },
      lifecycle: {
        machineCode: "ok",
        status: "ended",
        eventId: null,
        replayed: false,
        changed: true,
        requestIdempotencyToken,
        draftRevision: competition.draftRevision,
        selectedProblemCount: null,
      },
    });
  }

  if (error) {
    return jsonDatabaseError(error);
  }

  const lifecycleResult = normalizeLifecycleOutcome(normalizeCompetitionLifecycleResult(data));
  if (!lifecycleResult) {
    return jsonError("operation_failed", "Competition end failed.", 500);
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
