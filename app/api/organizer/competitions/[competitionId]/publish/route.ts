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
  withCompetitionStatus,
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
  let selectedProblemCount: number | null = null;
  const { data, error } = await adminClient.rpc("publish_competition", {
    p_competition_id: competitionId,
    p_request_idempotency_token: requestIdempotencyToken,
  });

  if (error && isLegacyCompetitionSchemaError(error)) {
    if (competition.status !== "draft") {
      return jsonError(
        "invalid_transition",
        competitionLifecycleErrorMessage("invalid_transition"),
        competitionLifecycleErrorStatus("invalid_transition"),
        {
          status: competition.status,
          replayed: false,
          changed: false,
        },
      );
    }

    const { count, error: countError } = await adminClient
      .from("competition_problems")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", competitionId);

    if (countError) {
      return jsonDatabaseError(countError);
    }

    selectedProblemCount = typeof count === "number" ? count : 0;

    if (selectedProblemCount === 0) {
      return jsonError(
        "no_problems_selected",
        competitionLifecycleErrorMessage("no_problems_selected"),
        competitionLifecycleErrorStatus("no_problems_selected"),
        {
          status: competition.status,
          replayed: false,
          changed: false,
          selectedProblemCount,
        },
      );
    }

    if (selectedProblemCount < 10 || selectedProblemCount > 100) {
      return jsonError(
        "problem_count_out_of_range",
        competitionLifecycleErrorMessage("problem_count_out_of_range"),
        competitionLifecycleErrorStatus("problem_count_out_of_range"),
        {
          status: competition.status,
          replayed: false,
          changed: false,
          selectedProblemCount,
        },
      );
    }

    const legacyPublishResult = await adminClient
      .from("competitions")
      .update({
        published: true,
        is_paused: false,
      })
      .eq("id", competitionId)
      .eq("organizer_id", actor.userId)
      .select("id")
      .maybeSingle();

    if (legacyPublishResult.error) {
      return jsonDatabaseError(legacyPublishResult.error);
    }

    if (!legacyPublishResult.data) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
    if ("response" in refreshed) {
      if (refreshed.response.status !== 404 && refreshed.response.status !== 503) {
        return refreshed.response;
      }
    }

    return jsonOk({
      code: "ok",
      competition:
        "response" in refreshed
          ? withCompetitionStatus(competition, "published")
          : refreshed.competition.status === "published"
            ? refreshed.competition
            : withCompetitionStatus(refreshed.competition, "published"),
      lifecycle: {
        machineCode: "ok",
        status: "published",
        eventId: null,
        replayed: false,
        changed: true,
        requestIdempotencyToken,
        draftRevision: competition.draftRevision,
        selectedProblemCount: selectedProblemCount ?? 0,
      },
    });
  }

  if (error) {
    return jsonDatabaseError(error);
  }

  const lifecycleResult = normalizeLifecycleOutcome(normalizeCompetitionLifecycleResult(data));
  if (lifecycleResult && lifecycleResult.machineCode !== "ok") {
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

  const publishedCompetition = withCompetitionStatus(competition, "published");

  const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
  if ("response" in refreshed) {
    if (refreshed.response.status === 404 || refreshed.response.status === 503) {
      return jsonOk({
        code: "ok",
        competition: publishedCompetition,
        lifecycle: {
          machineCode: "ok",
          status: "published",
          eventId: null,
          replayed: false,
          changed: true,
          requestIdempotencyToken,
          draftRevision: competition.draftRevision,
          selectedProblemCount: lifecycleResult?.selectedProblemCount ?? selectedProblemCount ?? 0,
        },
      });
    }

    return refreshed.response;
  }

  return jsonOk({
    code: "ok",
    competition:
      refreshed.competition.status === "published"
        ? refreshed.competition
        : withCompetitionStatus(refreshed.competition, "published"),
    lifecycle:
      lifecycleResult && lifecycleResult.machineCode === "ok"
        ? lifecycleResult
        : {
            machineCode: "ok",
            status: "published",
            eventId: null,
            replayed: false,
            changed: true,
            requestIdempotencyToken,
            draftRevision: competition.draftRevision,
            selectedProblemCount: lifecycleResult?.selectedProblemCount ?? selectedProblemCount ?? 0,
          },
  });
}
