import { createDefaultCompetitionDraftState, validateCompetitionDraftInput } from "@/lib/competition/validation";
import { COMPETITION_SELECT_COLUMNS, normalizeCompetitionLifecycleResult, normalizeCompetitionRecord } from "@/lib/competition/api";
import type { CompetitionDraftFormState, CompetitionRecord } from "@/lib/competition/types";
import {
  buildLegacyCompetitionMutationPayload,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  isLegacyCompetitionSchemaError,
  requireCompetitionAdminClient,
  requireOrganizerCompetitionActor,
  requireSameOriginMutation,
  replaceCompetitionProblemsLegacy,
  validateCompetitionProblemSelection,
} from "./_shared";

function buildCreationDraftState(payload: Record<string, unknown> | null): CompetitionDraftFormState {
  const baseState = createDefaultCompetitionDraftState();
  const type = payload?.type === "scheduled" ? "scheduled" : "open";
  const format = payload?.format === "team" ? "team" : "individual";
  const selectedProblemIds = Array.isArray(payload?.selectedProblemIds)
    ? payload.selectedProblemIds.filter((problemId): problemId is string => typeof problemId === "string")
    : [];

  return {
    ...baseState,
    type,
    format,
    registrationStart: "",
    registrationEnd: "",
    startTime: "",
    endTime: "",
    durationMinutes: typeof payload?.durationMinutes === "number" ? payload.durationMinutes : baseState.durationMinutes,
    attemptsAllowed: typeof payload?.attemptsAllowed === "number" ? payload.attemptsAllowed : 1,
    maxParticipants: format === "individual" ? 3 : null,
    participantsPerTeam: format === "team" ? 2 : null,
    maxTeams: format === "team" ? 3 : null,
    scoringMode: baseState.scoringMode,
    customPointsByProblemId: {},
    penaltyMode: baseState.penaltyMode,
    deductionValue: baseState.deductionValue,
    tieBreaker: baseState.tieBreaker,
    shuffleQuestions: false,
    shuffleOptions: false,
    logTabSwitch: false,
    offensePenalties: [],
    answerKeyVisibility: baseState.answerKeyVisibility,
    selectedProblemIds,
  };
}

export async function GET() {
  const auth = await requireOrganizerCompetitionActor();

  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, actor } = auth;

  const { data, error } = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("organizer_id", actor.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonDatabaseError(error);
  }

  const competitions = (data ?? [])
    .map((row) => normalizeCompetitionRecord(row))
    .filter((row): row is CompetitionRecord => row !== null);

  return jsonOk({
    code: "ok",
    competitions,
  });
}

export async function POST(request: Request) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireOrganizerCompetitionActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, actor } = auth;
  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  const baseState = buildCreationDraftState(payload);
  const draftInput = (payload ?? {}) as Partial<CompetitionDraftFormState>;
  const selectedProblemIds = Array.isArray(draftInput.selectedProblemIds)
    ? draftInput.selectedProblemIds.filter((problemId): problemId is string => typeof problemId === "string")
    : baseState.selectedProblemIds;

  const validation = validateCompetitionDraftInput({
    ...baseState,
    ...draftInput,
    selectedProblemIds,
  });

  if (!validation.ok || !validation.value) {
    return jsonError("validation_failed", "Request validation failed.", 400, {
      errors: validation.errors,
    });
  }

  const selectionCheck = await validateCompetitionProblemSelection(supabase, validation.value.selectedProblemIds);
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

  const insertPayload = {
    organizer_id: actor.userId,
    name: validation.value.name,
    description: validation.value.description,
    instructions: validation.value.instructions,
    type: validation.value.type,
    format: validation.value.format,
    registration_start: validation.value.registrationStart,
    registration_end: validation.value.registrationEnd,
    start_time: validation.value.startTime,
    end_time: validation.value.endTime,
    duration_minutes: validation.value.durationMinutes,
    attempts_allowed: validation.value.attemptsAllowed,
    multi_attempt_grading_mode: validation.value.multiAttemptGradingMode,
    max_participants: validation.value.maxParticipants,
    participants_per_team: validation.value.participantsPerTeam,
    max_teams: validation.value.maxTeams,
    scoring_mode: validation.value.scoringMode,
    custom_points: validation.value.customPointsByProblemId,
    penalty_mode: validation.value.penaltyMode,
    deduction_value: validation.value.deductionValue,
    tie_breaker: validation.value.tieBreaker,
    shuffle_questions: validation.value.shuffleQuestions,
    shuffle_options: validation.value.shuffleOptions,
    log_tab_switch: validation.value.logTabSwitch,
    offense_penalties: validation.value.offensePenalties,
    published: false,
    is_paused: false,
  };

  const legacyInsertPayload = {
    organizer_id: actor.userId,
    ...buildLegacyCompetitionMutationPayload(validation.value),
  };

  let createdCompetitionResult = await adminClient
    .from("competitions")
    .insert(insertPayload)
    .select(COMPETITION_SELECT_COLUMNS)
    .single();

  if (createdCompetitionResult.error && isLegacyCompetitionSchemaError(createdCompetitionResult.error)) {
    createdCompetitionResult = await adminClient
      .from("competitions")
      .insert(legacyInsertPayload)
      .select(COMPETITION_SELECT_COLUMNS)
      .single();
  }

  const { data, error } = createdCompetitionResult;

  if (error) {
    if (error.code === "23505") {
      return jsonError("duplicate_name", "A competition with this name already exists.", 409);
    }

    return jsonDatabaseError(error);
  }

  const competition = normalizeCompetitionRecord(data);
  if (!competition) {
    return jsonError("operation_failed", "Competition could not be created.", 500);
  }

  if (selectionCheck.selectedProblemIds.length > 0) {
    const { data: savedResult, error: saveError } = await adminClient.rpc("save_competition_draft", {
      p_competition_id: competition.id,
      p_expected_draft_revision: competition.draftRevision,
      p_payload_json: validation.value,
    });

    if (saveError && isLegacyCompetitionSchemaError(saveError)) {
      const legacySyncResult = await replaceCompetitionProblemsLegacy(
        adminClient,
        competition.id,
        selectionCheck.selectedProblemIds,
      );

      if ("error" in legacySyncResult) {
        return jsonDatabaseError(legacySyncResult.error);
      }

      return jsonOk(
        {
          code: "created",
          competition,
          selectedProblemCount: legacySyncResult.selectedProblemCount,
          currentDraftRevision: competition.draftRevision,
        },
        201,
      );
    }

    if (saveError) {
      return jsonDatabaseError(saveError);
    }

    const savedLifecycle = normalizeCompetitionLifecycleResult(savedResult);
    if (!savedLifecycle || savedLifecycle.machineCode !== "ok") {
      return jsonError("operation_failed", "Competition could not be created.", 500, {
        machineCode: savedLifecycle?.machineCode ?? null,
        selectedProblemCount: savedLifecycle?.selectedProblemCount ?? null,
      });
    }

    const refreshed = await supabase
      .from("competitions")
      .select(COMPETITION_SELECT_COLUMNS)
      .eq("id", competition.id)
      .eq("organizer_id", actor.userId)
      .maybeSingle();

    if (refreshed.error) {
      return jsonDatabaseError(refreshed.error);
    }

    const refreshedCompetition = normalizeCompetitionRecord(refreshed.data);
    if (!refreshedCompetition) {
      return jsonError("operation_failed", "Competition could not be created.", 500);
    }

    return jsonOk(
      {
        code: "created",
        competition: refreshedCompetition,
        selectedProblemCount: savedLifecycle.selectedProblemCount ?? 0,
        currentDraftRevision: savedLifecycle.currentDraftRevision ?? refreshedCompetition.draftRevision,
      },
      201,
    );
  }

  return jsonOk(
    {
      code: "created",
      competition,
    },
    201,
  );
}
