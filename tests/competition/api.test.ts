import { describe, expect, test } from "vitest";
import {
  buildLegacyCompetitionMutationPayload,
  competitionRecordToFormState,
  normalizeCompetitionLifecycleResult,
  normalizeCompetitionProblemPreview,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";

describe("competition api helpers", () => {
  test("normalizes competition rows into shared record shape", () => {
    const record = normalizeCompetitionRecord({
      id: "competition-1",
      organizer_id: "organizer-1",
      name: "Spring Invitational",
      description: "High stakes open event",
      instructions: "No calculators.",
      type: "open",
      format: "individual",
      status: "published",
      answer_key_visibility: "hidden",
      registration_start: null,
      registration_end: null,
      start_time: null,
      end_time: null,
      duration_minutes: 90,
      attempts_allowed: 3,
      multi_attempt_grading_mode: "latest_score",
      max_participants: 40,
      participants_per_team: null,
      max_teams: null,
      scoring_mode: "custom",
      custom_points: { problem_a: 5 },
      penalty_mode: "fixed_deduction",
      deduction_value: 1,
      tie_breaker: "lowest_total_time",
      shuffle_questions: true,
      shuffle_options: false,
      log_tab_switch: true,
      offense_penalties: [{ threshold: 2, penaltyKind: "warning", deductionValue: 0 }],
      scoring_snapshot_json: { scoringMode: "custom" },
      draft_revision: 4,
      draft_version: 2,
      is_deleted: false,
      published_at: "2026-04-10T12:00:00.000Z",
      created_at: "2026-04-01T12:00:00.000Z",
      updated_at: "2026-04-11T12:00:00.000Z",
    });

    expect(record).not.toBeNull();
    expect(record?.status).toBe("published");
    expect(record?.multiAttemptGradingMode).toBe("latest_score");
    expect(record?.scoringSnapshotJson).toEqual({ scoringMode: "custom" });
    expect(record?.publishedAt).toBe("2026-04-10T12:00:00.000Z");
  });

  test("normalizes legacy competition enum values into current form state", () => {
    const record = normalizeCompetitionRecord({
      id: "competition-legacy",
      organizer_id: "organizer-1",
      name: "Legacy Invitational",
      description: "Legacy row",
      instructions: "Legacy rules",
      type: "scheduled",
      format: "individual",
      answer_key_visibility: "after_end",
      registration_start: null,
      registration_end: null,
      start_time: null,
      duration_minutes: 60,
      attempts_allowed: 1,
      multi_attempt_grading_mode: null,
      max_participants: 12,
      participants_per_team: null,
      max_teams: null,
      scoring_mode: "automatic",
      custom_points: {},
      penalty_mode: "deduction",
      deduction_value: 2,
      tie_breaker: "average_time",
      shuffle_questions: false,
      shuffle_options: false,
      log_tab_switch: false,
      offense_penalties: [],
      scoring_snapshot_json: null,
      draft_revision: 1,
      draft_version: 1,
      is_deleted: false,
      published_at: null,
      created_at: "2026-04-01T12:00:00.000Z",
    });

    expect(record).not.toBeNull();
    expect(record?.scoringMode).toBe("difficulty");
    expect(record?.penaltyMode).toBe("fixed_deduction");
    expect(record?.tieBreaker).toBe("lowest_total_time");
  });

  test("maps current competition enums back to legacy insert values", () => {
    const payload = buildLegacyCompetitionMutationPayload({
      name: "Legacy payload",
      description: "Legacy description",
      instructions: "Legacy instructions",
      type: "scheduled",
      format: "individual",
      registrationStart: "2026-05-01T01:00:00.000Z",
      registrationEnd: "2026-05-01T02:00:00.000Z",
      startTime: "2026-05-01T03:00:00.000Z",
      endTime: null,
      durationMinutes: 60,
      attemptsAllowed: 1,
      multiAttemptGradingMode: "highest_score",
      maxParticipants: 3,
      participantsPerTeam: null,
      maxTeams: null,
      scoringMode: "difficulty",
      customPointsByProblemId: {},
      penaltyMode: "fixed_deduction",
      deductionValue: 0,
      tieBreaker: "lowest_total_time",
      shuffleQuestions: false,
      shuffleOptions: false,
      logTabSwitch: false,
      offensePenalties: [],
      answerKeyVisibility: "after_end",
      selectedProblemIds: [],
    });

    expect(payload.scoring_mode).toBe("automatic");
    expect(payload.penalty_mode).toBe("deduction");
    expect(payload.tie_breaker).toBe("average_time");
    expect(payload.start_time).toBe("2026-05-01T03:00:00.000Z");
    expect(payload).not.toHaveProperty("end_time");
  });

  test("normalizes competition form state with selected problems", () => {
    const record = normalizeCompetitionRecord({
      id: "competition-2",
      organizer_id: "organizer-1",
      name: "Draft Competition",
      description: "Draft description",
      instructions: "Rules",
      type: "scheduled",
      format: "team",
      status: "draft",
      answer_key_visibility: "after_end",
      registration_start: "2026-05-01T09:00:00.000Z",
      registration_end: "2026-05-02T09:00:00.000Z",
      start_time: "2026-05-10T09:00:00.000Z",
      end_time: null,
      duration_minutes: 120,
      attempts_allowed: 1,
      multi_attempt_grading_mode: "highest_score",
      max_participants: null,
      participants_per_team: 4,
      max_teams: 10,
      scoring_mode: "difficulty",
      custom_points: {},
      penalty_mode: "none",
      deduction_value: 0,
      tie_breaker: "earliest_final_submission",
      shuffle_questions: false,
      shuffle_options: false,
      log_tab_switch: false,
      offense_penalties: [],
      scoring_snapshot_json: null,
      draft_revision: 1,
      draft_version: 1,
      is_deleted: false,
      published_at: null,
      created_at: "2026-04-01T12:00:00.000Z",
      updated_at: "2026-04-02T12:00:00.000Z",
    });

    expect(record).not.toBeNull();
    if (!record) {
      return;
    }

    const formState = competitionRecordToFormState(record, ["problem-a", "problem-b"]);

    expect(formState.type).toBe("scheduled");
    expect(formState.format).toBe("team");
    expect(formState.selectedProblemIds).toEqual(["problem-a", "problem-b"]);
    expect(formState.registrationStart).toContain("2026-05-01");
  });

  test("normalizes lifecycle rpc rows from array payloads", () => {
    const result = normalizeCompetitionLifecycleResult([
      {
        machine_code: "ok",
        competition_id: "competition-1",
        status: "draft",
        draft_revision: 5,
        draft_version: 6,
        selected_problem_count: 12,
        updated_at: "2026-04-11T12:00:00.000Z",
        replayed: false,
        changed: true,
        request_idempotency_token: "token-123",
      },
    ]);

    expect(result).not.toBeNull();
    expect(result?.machineCode).toBe("ok");
    expect(result?.draftRevision).toBe(5);
    expect(result?.draftVersion).toBe(6);
    expect(result?.selectedProblemCount).toBe(12);
    expect(result?.currentDraftRevision).toBe(5);
  });

  test("normalizes lifecycle rpc rows from scalar machine-code payloads", () => {
    const fromScalar = normalizeCompetitionLifecycleResult("ok");
    const fromArrayScalar = normalizeCompetitionLifecycleResult(["invalid_transition"]);

    expect(fromScalar).not.toBeNull();
    expect(fromScalar?.machineCode).toBe("ok");
    expect(fromScalar?.status).toBeNull();

    expect(fromArrayScalar).not.toBeNull();
    expect(fromArrayScalar?.machineCode).toBe("invalid_transition");
    expect(fromArrayScalar?.status).toBeNull();
  });

  test("normalizes lifecycle rpc rows from wrapped and camelCase payloads", () => {
    const result = normalizeCompetitionLifecycleResult({
      publish_competition: {
        machineCode: "ok",
        competitionId: "competition-1",
        currentStatus: "published",
        requestIdempotencyToken: "token-xyz",
        replayed: "true",
        changed: "false",
        currentDraftRevision: "8",
        selectedProblemCount: "10",
      },
    });

    expect(result).not.toBeNull();
    expect(result?.machineCode).toBe("ok");
    expect(result?.status).toBe("published");
    expect(result?.requestIdempotencyToken).toBe("token-xyz");
    expect(result?.replayed).toBe(true);
    expect(result?.changed).toBe(false);
    expect(result?.currentDraftRevision).toBe(8);
    expect(result?.selectedProblemCount).toBe(10);
  });

  test("normalizes competition problem previews with nested problem rows", () => {
    const preview = normalizeCompetitionProblemPreview({
      id: "competition-problem-1",
      competition_id: "competition-1",
      problem_id: "problem-1",
      order_index: 2,
      points: 7,
      content_snapshot_latex: "Solve for x.",
      options_snapshot_json: null,
      answer_key_snapshot_json: null,
      explanation_snapshot_latex: "Use algebra.",
      difficulty_snapshot: "easy",
      tags_snapshot: ["algebra", "warmup"],
      image_snapshot_path: null,
      problem_bank_name: "Default bank",
      problems: {
        id: "problem-1",
        bank_id: "bank-1",
        type: "mcq",
        difficulty: "easy",
        tags: ["algebra", "warmup"],
        content_latex: "Solve for x.",
        explanation_latex: "Use algebra.",
        authoring_notes: "",
        image_path: null,
        is_deleted: false,
        created_at: "2026-04-01T12:00:00.000Z",
        updated_at: "2026-04-01T12:00:00.000Z",
      },
    });

    expect(preview).not.toBeNull();
    expect(preview?.problem.bankName).toBe("Default bank");
    expect(preview?.orderIndex).toBe(2);
    expect(preview?.tagsSnapshot).toEqual(["algebra", "warmup"]);
  });
});
