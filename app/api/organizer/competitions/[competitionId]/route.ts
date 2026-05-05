import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  LEGACY_COMPETITION_SELECT_COLUMNS,
  competitionRecordToFormState,
  normalizeCompetitionLifecycleResult,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import { validateCompetitionDraftInput } from "@/lib/competition/validation";
import {
  buildCompetitionDraftRpcPayload,
  buildLegacySchemaCompetitionMutationPayload,
  fetchCompetition,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  isLegacyCompetitionSchemaError,
  requireCompetitionAdminClient,
  requireOrganizerCompetitionActor,
  requireSameOriginMutation,
  replaceCompetitionProblemsLegacy,
  validateCompetitionProblemSelection,
} from "../_shared";

async function fetchSelectedProblemIds(supabase: Awaited<ReturnType<typeof createClient>>, competitionId: string) {
  const normalizeIds = (rows: Array<{ problem_id: unknown }> | null) =>
    (rows ?? []).map((row) => row.problem_id).filter((id): id is string => typeof id === "string");

  const scopedResult = await supabase
    .from("competition_problems")
    .select("problem_id, order_index")
    .eq("competition_id", competitionId)
    .order("order_index", { ascending: true });

  if (!scopedResult.error) {
    const scopedIds = normalizeIds(scopedResult.data as Array<{ problem_id: unknown }> | null);
    if (scopedIds.length > 0) {
      return {
        selectedProblemIds: scopedIds,
      } as const;
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return {
        selectedProblemIds: scopedIds,
      } as const;
    }

    const adminResult = await adminClient
      .from("competition_problems")
      .select("problem_id, order_index")
      .eq("competition_id", competitionId)
      .order("order_index", { ascending: true });

    if (!adminResult.error) {
      return {
        selectedProblemIds: normalizeIds(adminResult.data as Array<{ problem_id: unknown }> | null),
      } as const;
    }

    return { response: jsonDatabaseError(adminResult.error) } as const;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return { response: jsonDatabaseError(scopedResult.error) } as const;
  }

  const adminResult = await adminClient
    .from("competition_problems")
    .select("problem_id, order_index")
    .eq("competition_id", competitionId)
    .order("order_index", { ascending: true });

  if (adminResult.error) {
    return { response: jsonDatabaseError(adminResult.error) } as const;
  }

  return {
    selectedProblemIds: normalizeIds(adminResult.data as Array<{ problem_id: unknown }> | null),
  } as const;
}

export async function GET(_: Request, context: { params: Promise<{ competitionId: string }> }) {
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

  const selectedProblemIdsResult = await fetchSelectedProblemIds(supabase, competitionId);
  if ("response" in selectedProblemIdsResult) {
    return selectedProblemIdsResult.response;
  }

  return jsonOk({
    code: "ok",
    competition,
    formState: competitionRecordToFormState(competition, selectedProblemIdsResult.selectedProblemIds),
    selectedProblemIds: selectedProblemIdsResult.selectedProblemIds,
    selectedProblemCount: selectedProblemIdsResult.selectedProblemIds.length,
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
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

  if (competition.status !== "draft") {
    return jsonError(
      "invalid_transition",
      "Only draft competitions can be edited.",
      409,
      { currentStatus: competition.status },
    );
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) {
    return jsonError("validation_failed", "Request body is required.", 400);
  }

  const selectedProblemIdsResult = await fetchSelectedProblemIds(supabase, competitionId);
  if ("response" in selectedProblemIdsResult) {
    return selectedProblemIdsResult.response;
  }

  const currentFormState = competitionRecordToFormState(competition, selectedProblemIdsResult.selectedProblemIds);
  if (
    Object.prototype.hasOwnProperty.call(payload, "expectedDraftRevision") &&
    typeof payload.expectedDraftRevision !== "number"
  ) {
    return jsonError("validation_failed", "Expected draft revision must be a number.", 400);
  }

  const expectedDraftRevision =
    typeof payload.expectedDraftRevision === "number" ? payload.expectedDraftRevision : competition.draftRevision;

  const validation = validateCompetitionDraftInput({
    ...currentFormState,
    ...payload,
  });

  if (!validation.ok || !validation.value) {
    return jsonError("validation_failed", "Request validation failed.", 400, {
      errors: validation.errors,
    });
  }

  const selectedProblemIds = validation.value.selectedProblemIds;
  const selectionCheck = await validateCompetitionProblemSelection(supabase, selectedProblemIds);
  if ("response" in selectionCheck) {
    return selectionCheck.response;
  }

  if (selectionCheck.missingProblemIds.length > 0) {
    return jsonError("problem_selection_invalid", "One or more selected problems are not accessible.", 400, {
      missingProblemIds: selectionCheck.missingProblemIds,
    });
  }

  const adminClientResult = requireCompetitionAdminClient();
  if ("response" in adminClientResult) {
    return adminClientResult.response;
  }

  const { adminClient } = adminClientResult;
  const rpcPayload = buildCompetitionDraftRpcPayload(validation.value);
  const { data: savedResult, error: saveError } = await adminClient.rpc("save_competition_draft", {
    p_competition_id: competitionId,
    p_expected_draft_revision: expectedDraftRevision,
    p_payload_json: rpcPayload,
  });

  if (saveError && isLegacyCompetitionSchemaError(saveError)) {
    const legacyUpdateResult = await adminClient
      .from("competitions")
      .update({
        ...buildLegacySchemaCompetitionMutationPayload(validation.value),
      })
      .eq("id", competitionId)
      .select(LEGACY_COMPETITION_SELECT_COLUMNS)
      .single();

    if (legacyUpdateResult.error) {
      return jsonDatabaseError(legacyUpdateResult.error);
    }

    const legacyCompetition = normalizeCompetitionRecord(legacyUpdateResult.data);
    if (!legacyCompetition) {
      const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
      if ("response" in refreshed) {
        return refreshed.response;
      }

      return jsonOk({
        code: "ok",
        competition: refreshed.competition,
        machineCode: "ok",
        selectedProblemCount: selectionCheck.selectedProblemIds.length,
        currentDraftRevision: refreshed.competition.draftRevision,
      });
    }

    const legacySelectionResult = await replaceCompetitionProblemsLegacy(
      adminClient,
      competitionId,
      selectedProblemIds,
    );

    if ("error" in legacySelectionResult) {
      return jsonDatabaseError(legacySelectionResult.error);
    }

    return jsonOk({
      code: "ok",
      competition: legacyCompetition,
      machineCode: "ok",
      selectedProblemCount: legacySelectionResult.selectedProblemCount,
      currentDraftRevision: legacyCompetition.draftRevision,
    });
  }

  if (saveError) {
    return jsonDatabaseError(saveError);
  }

  try {
    const safeExamBrowserUpdate = await adminClient
      .from("competitions")
      .update({
        safe_exam_browser_mode: validation.value.safeExamBrowserMode,
        safe_exam_browser_config_key_hashes: validation.value.safeExamBrowserConfigKeyHashes,
      })
      .eq("id", competitionId);

    if (safeExamBrowserUpdate.error && !isLegacyCompetitionSchemaError(safeExamBrowserUpdate.error)) {
      return jsonDatabaseError(safeExamBrowserUpdate.error);
    }
  } catch (error) {
    if (!isLegacyCompetitionSchemaError(error as { code?: string | null; message?: string | null })) {
      return jsonDatabaseError(error);
    }
  }

  const lifecycleResult = normalizeCompetitionLifecycleResult(savedResult);
  if (!lifecycleResult) {
    const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
    if ("response" in refreshed) {
      return refreshed.response;
    }

    return jsonOk({
      code: "ok",
      competition: refreshed.competition,
      machineCode: "ok",
      selectedProblemCount: selectedProblemIds.length,
      currentDraftRevision: refreshed.competition.draftRevision,
    });
  }

  if (lifecycleResult.machineCode !== "ok") {
    const status =
      lifecycleResult.machineCode === "draft_write_conflict" || lifecycleResult.machineCode === "invalid_transition"
        ? 409
        : lifecycleResult.machineCode === "forbidden"
          ? 403
          : 400;

    return jsonError(lifecycleResult.machineCode, "Draft save failed.", status, {
      currentDraftRevision: lifecycleResult.currentDraftRevision ?? null,
      selectedProblemCount: lifecycleResult.selectedProblemCount ?? null,
    });
  }

  const refreshed = await fetchCompetition(supabase, competitionId, actor.userId);
  if ("response" in refreshed) {
    return refreshed.response;
  }

  return jsonOk({
    code: "ok",
    competition: refreshed.competition,
    machineCode: lifecycleResult.machineCode,
    selectedProblemCount: lifecycleResult.selectedProblemCount ?? 0,
    currentDraftRevision: lifecycleResult.currentDraftRevision ?? refreshed.competition.draftRevision,
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ competitionId: string }> }) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
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

  if (competition.status !== "draft") {
    return jsonError("invalid_transition", "Only draft competitions can be deleted.", 409, {
      currentStatus: competition.status,
    });
  }

  const adminClientResult = requireCompetitionAdminClient();
  if ("response" in adminClientResult) {
    return adminClientResult.response;
  }

  const { adminClient } = adminClientResult;
  const { data, error } = await adminClient.rpc("delete_draft_competition", {
    p_competition_id: competitionId,
    p_request_idempotency_token: request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key"),
  });

  if (error && isLegacyCompetitionSchemaError(error)) {
    const fallbackDelete = await adminClient
      .from("competitions")
      .update({
        is_deleted: true,
      })
      .eq("id", competitionId)
      .eq("organizer_id", actor.userId)
      .eq("published", false)
      .select("id")
      .maybeSingle();

    if (fallbackDelete.error && isLegacyCompetitionSchemaError(fallbackDelete.error)) {
      return jsonError(
        "service_unavailable",
        "Competition draft deletion is temporarily unavailable while database migrations are incomplete.",
        503,
        {
          currentStatus: competition.status,
          changed: false,
          replayed: false,
        },
      );
    }

    if (fallbackDelete.error) {
      return jsonDatabaseError(fallbackDelete.error);
    }

    if (!fallbackDelete.data) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    return jsonOk({
      code: "ok",
      machineCode: "ok",
      currentStatus: competition.status,
      isDeleted: true,
    });
  }

  if (error) {
    return jsonDatabaseError(error);
  }

  const lifecycleResult = normalizeCompetitionLifecycleResult(data);
  if (lifecycleResult && lifecycleResult.machineCode !== "ok") {
    return jsonError(lifecycleResult.machineCode, "Competition could not be deleted.", 409, {
      currentStatus: lifecycleResult.currentStatus,
    });
  }

  return jsonOk({
    code: "ok",
    machineCode: lifecycleResult?.machineCode ?? "ok",
    currentStatus: lifecycleResult?.currentStatus ?? competition.status,
    isDeleted: true,
  });
}
