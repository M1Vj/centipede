import { describe, expect, test } from "vitest";
import {
  SCORING_RPC_NAMES,
  parseGradeAttemptRpcRow,
  parseRecalculateCompetitionScoresRpcRow,
  parseRefreshLeaderboardEntriesRpcRow,
  toGradeAttemptRpcArgs,
  toRecalculateCompetitionScoresRpcArgs,
  toRefreshLeaderboardEntriesRpcArgs,
  validateGradeAttemptRpcParams,
  validateRecalculateCompetitionScoresRpcParams,
  validateRefreshLeaderboardEntriesRpcParams,
} from "@/lib/scoring/rpc-contracts";

const ATTEMPT_ID = "ccf328de-e831-4f52-a4cf-e2da67663f7d";
const COMPETITION_ID = "0e123f63-bf41-4f6a-a2aa-23df88f712f5";

describe("scoring rpc contracts", () => {
  test("exposes stable rpc names", () => {
    expect(SCORING_RPC_NAMES).toEqual({
      gradeAttempt: "grade_attempt",
      recalculateCompetitionScores: "recalculate_competition_scores",
      refreshLeaderboardEntries: "refresh_leaderboard_entries",
    });
  });

  test("validates params and converts to rpc args", () => {
    const gradeParams = validateGradeAttemptRpcParams({ attemptId: ATTEMPT_ID });
    expect(gradeParams.ok).toBe(true);
    expect(toGradeAttemptRpcArgs({ attemptId: ATTEMPT_ID })).toEqual({
      p_attempt_id: ATTEMPT_ID,
    });

    const recalcParams = validateRecalculateCompetitionScoresRpcParams({
      competitionId: COMPETITION_ID,
      requestIdempotencyToken: "req-1234",
    });
    expect(recalcParams.ok).toBe(true);
    expect(
      toRecalculateCompetitionScoresRpcArgs({
        competitionId: COMPETITION_ID,
        requestIdempotencyToken: "req-1234",
      }),
    ).toEqual({
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "req-1234",
    });

    const refreshParams = validateRefreshLeaderboardEntriesRpcParams({
      competitionId: COMPETITION_ID,
    });
    expect(refreshParams.ok).toBe(true);
    expect(toRefreshLeaderboardEntriesRpcArgs({ competitionId: COMPETITION_ID })).toEqual({
      p_competition_id: COMPETITION_ID,
    });
  });

  test("rejects invalid rpc params", () => {
    expect(validateGradeAttemptRpcParams({ attemptId: "bad" }).ok).toBe(false);
    expect(
      validateRecalculateCompetitionScoresRpcParams({
        competitionId: "bad",
        requestIdempotencyToken: "",
      }).ok,
    ).toBe(false);

    expect(
      validateRecalculateCompetitionScoresRpcParams({
        competitionId: COMPETITION_ID,
        requestIdempotencyToken: "bad token",
      }).ok,
    ).toBe(false);
    expect(validateRefreshLeaderboardEntriesRpcParams({ competitionId: "bad" }).ok).toBe(false);
  });

  test("parses grade attempt rpc row", () => {
    const parsed = parseGradeAttemptRpcRow({
      attempt_id: ATTEMPT_ID,
      competition_id: COMPETITION_ID,
      machine_code: "graded",
      raw_score: "8",
      penalty_score: 2,
      final_score: 6,
      graded_at: "2026-04-09T13:20:00.000Z",
    });

    expect(parsed).toEqual({
      attemptId: ATTEMPT_ID,
      competitionId: COMPETITION_ID,
      machineCode: "graded",
      rawScore: 8,
      penaltyScore: 2,
      finalScore: 6,
      gradedAt: "2026-04-09T13:20:00.000Z",
    });

    const parsedStrictNumeric = parseGradeAttemptRpcRow({
      attempt_id: ATTEMPT_ID,
      competition_id: COMPETITION_ID,
      machine_code: "graded",
      raw_score: " 1e2 ",
      penalty_score: "1.5",
      final_score: "98.5",
      graded_at: "2026-04-09T13:20:00.000Z",
    });

    expect(parsedStrictNumeric).toEqual({
      attemptId: ATTEMPT_ID,
      competitionId: COMPETITION_ID,
      machineCode: "graded",
      rawScore: 100,
      penaltyScore: 1.5,
      finalScore: 98.5,
      gradedAt: "2026-04-09T13:20:00.000Z",
    });

    expect(parseGradeAttemptRpcRow({ attempt_id: "bad" })).toBeNull();
    expect(
      parseGradeAttemptRpcRow({
        attempt_id: ATTEMPT_ID,
        competition_id: COMPETITION_ID,
        machine_code: "graded",
        raw_score: "22abc",
        penalty_score: 0,
        final_score: 22,
        graded_at: "2026-04-09T13:20:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseGradeAttemptRpcRow({
        attempt_id: ATTEMPT_ID,
        competition_id: COMPETITION_ID,
        machine_code: "",
        raw_score: 1,
        penalty_score: 0,
        final_score: 1,
        graded_at: "2026-04-09T13:20:00.000Z",
      }),
    ).toBeNull();
  });

  test("parses recalculate and leaderboard refresh rows", () => {
    const recalc = parseRecalculateCompetitionScoresRpcRow({
      competition_id: COMPETITION_ID,
      request_idempotency_token: "req-1234",
      machine_code: "ok",
      graded_attempts: 11.9,
      refreshed_rows: "22",
      recalculated_at: "2026-04-09T14:00:00.000Z",
    });

    expect(recalc).toEqual({
      competitionId: COMPETITION_ID,
      requestIdempotencyToken: "req-1234",
      machineCode: "ok",
      gradedAttempts: 11,
      refreshedRows: 22,
      recalculatedAt: "2026-04-09T14:00:00.000Z",
    });

    const refresh = parseRefreshLeaderboardEntriesRpcRow({
      competition_id: COMPETITION_ID,
      machine_code: "refreshed",
      refreshed_rows: "7",
      computed_at: "2026-04-09T14:30:00.000Z",
    });

    expect(refresh).toEqual({
      competitionId: COMPETITION_ID,
      machineCode: "refreshed",
      refreshedRows: 7,
      computedAt: "2026-04-09T14:30:00.000Z",
    });

    expect(parseRecalculateCompetitionScoresRpcRow({ competition_id: "bad" })).toBeNull();
    expect(parseRefreshLeaderboardEntriesRpcRow({ competition_id: "bad" })).toBeNull();
    expect(
      parseRecalculateCompetitionScoresRpcRow({
        competition_id: COMPETITION_ID,
        request_idempotency_token: "req-1234",
        machine_code: "ok",
        graded_attempts: "11abc",
        refreshed_rows: "22",
        recalculated_at: "2026-04-09T14:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseRefreshLeaderboardEntriesRpcRow({
        competition_id: COMPETITION_ID,
        machine_code: "refreshed",
        refreshed_rows: "7rows",
        computed_at: "2026-04-09T14:30:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseRecalculateCompetitionScoresRpcRow({
        competition_id: COMPETITION_ID,
        request_idempotency_token: "req-1234",
        machine_code: "ok",
        graded_attempts: "not-a-number",
        refreshed_rows: "22",
        recalculated_at: "2026-04-09T14:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseRefreshLeaderboardEntriesRpcRow({
        competition_id: COMPETITION_ID,
        machine_code: "ok",
        refreshed_rows: 3,
        computed_at: "",
      }),
    ).toBeNull();
  });
});
