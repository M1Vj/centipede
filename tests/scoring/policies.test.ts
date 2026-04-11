import { describe, expect, test } from "vitest";
import {
  applyPenaltyFloor,
  compareLeaderboardEntries,
  resolveBaseProblemPoints,
  resolveEffectiveProblemPoints,
  roundHalfAwayFromZero,
  selectAttemptScoreByMode,
  sortLeaderboardEntries,
} from "@/lib/scoring/policies";

describe("scoring policies", () => {
  test("applies deterministic penalty floor at zero", () => {
    expect(applyPenaltyFloor(10, 3)).toEqual({
      rawScore: 10,
      penaltyScore: 3,
      finalScore: 7,
    });

    expect(applyPenaltyFloor(4, 9)).toEqual({
      rawScore: 4,
      penaltyScore: 9,
      finalScore: 0,
    });

    expect(applyPenaltyFloor(6, -3)).toEqual({
      rawScore: 6,
      penaltyScore: 0,
      finalScore: 6,
    });

    expect(applyPenaltyFloor(Number.NaN, Number.POSITIVE_INFINITY)).toEqual({
      rawScore: 0,
      penaltyScore: 0,
      finalScore: 0,
    });
  });

  test("rounds half away from zero", () => {
    expect(roundHalfAwayFromZero(1.005, 2)).toBe(1.01);
    expect(roundHalfAwayFromZero(-1.005, 2)).toBe(-1.01);
    expect(roundHalfAwayFromZero(2.675, 2)).toBe(2.68);
    expect(roundHalfAwayFromZero(-2.675, 2)).toBe(-2.68);
    expect(roundHalfAwayFromZero(1.235, 2)).toBe(1.24);
    expect(roundHalfAwayFromZero(-1.235, 2)).toBe(-1.24);
  });

  test("selects highest and latest attempts deterministically", () => {
    const attempts = [
      {
        attemptId: "a1",
        registrationId: "r1",
        finalScore: 8,
        submittedAt: "2026-04-09T10:10:00.000Z",
        totalTimeSeconds: 200,
      },
      {
        attemptId: "a2",
        registrationId: "r1",
        finalScore: 9,
        submittedAt: "2026-04-09T10:20:00.000Z",
        totalTimeSeconds: 210,
      },
      {
        attemptId: "a3",
        registrationId: "r1",
        finalScore: 9,
        submittedAt: "2026-04-09T10:05:00.000Z",
        totalTimeSeconds: 205,
      },
    ] as const;

    const highest = selectAttemptScoreByMode("highest_score", attempts);
    expect(highest?.score).toBe(9);
    expect(highest?.sourceAttemptId).toBe("a3");

    const latest = selectAttemptScoreByMode("latest_score", attempts);
    expect(latest?.score).toBe(9);
    expect(latest?.sourceAttemptId).toBe("a2");
  });

  test("computes average_score once and rounds to 2 decimals", () => {
    const attempts = [
      {
        attemptId: "a1",
        registrationId: "r1",
        finalScore: 2,
        submittedAt: "2026-04-09T10:10:00.000Z",
        totalTimeSeconds: 120,
      },
      {
        attemptId: "a2",
        registrationId: "r1",
        finalScore: 3,
        submittedAt: "2026-04-09T10:20:00.000Z",
        totalTimeSeconds: 130,
      },
      {
        attemptId: "a3",
        registrationId: "r1",
        finalScore: 3,
        submittedAt: "2026-04-09T10:30:00.000Z",
        totalTimeSeconds: 140,
      },
    ] as const;

    const average = selectAttemptScoreByMode("average_score", attempts);
    expect(average?.score).toBe(2.67);
    expect(average?.sourceAttemptId).toBe("a3");
  });

  test("applies average_score rounding at half-step boundaries", () => {
    const attempts = [
      {
        attemptId: "a1",
        registrationId: "r1",
        finalScore: 1.005,
        submittedAt: "2026-04-09T10:00:00.000Z",
        totalTimeSeconds: 100,
      },
      {
        attemptId: "a2",
        registrationId: "r1",
        finalScore: 1.005,
        submittedAt: "2026-04-09T10:10:00.000Z",
        totalTimeSeconds: 100,
      },
    ] as const;

    const average = selectAttemptScoreByMode("average_score", attempts);
    expect(average?.score).toBe(1.01);
  });

  test("orders leaderboard with tie-breakers and stable fallback", () => {
    const left = {
      registrationId: "r1",
      attemptId: "a1",
      score: 10,
      submittedAt: "2026-04-09T10:05:00.000Z",
      totalTimeSeconds: 120,
    };

    const right = {
      registrationId: "r2",
      attemptId: "a2",
      score: 10,
      submittedAt: "2026-04-09T10:06:00.000Z",
      totalTimeSeconds: 110,
    };

    expect(compareLeaderboardEntries(left, right, "earliest_final_submission")).toBeLessThan(0);
    expect(compareLeaderboardEntries(left, right, "lowest_total_time")).toBeGreaterThan(0);

    const stableSorted = sortLeaderboardEntries(
      [
        {
          registrationId: "r2",
          attemptId: "a2",
          score: 7,
          submittedAt: null,
          totalTimeSeconds: null,
        },
        {
          registrationId: "r1",
          attemptId: "a1",
          score: 7,
          submittedAt: null,
          totalTimeSeconds: null,
        },
        {
          registrationId: "r1",
          attemptId: "a0",
          score: 7,
          submittedAt: null,
          totalTimeSeconds: null,
        },
      ],
      "earliest_final_submission",
    );

    expect(stableSorted.map((entry) => `${entry.registrationId}:${entry.attemptId ?? ""}`)).toEqual([
      "r1:a0",
      "r1:a1",
      "r2:a2",
    ]);
  });

  test("resolves base and effective points with precedence", () => {
    expect(resolveBaseProblemPoints("difficulty", "easy", {}, "cp1")).toBe(1);
    expect(resolveBaseProblemPoints("custom", "easy", { cp1: 6 }, "cp1")).toBe(6);
    expect(resolveBaseProblemPoints("custom", "difficult", {}, "cp-missing")).toBe(0);

    expect(resolveEffectiveProblemPoints({ basePoints: 4, activePointsOverride: null })).toBe(4);
    expect(resolveEffectiveProblemPoints({ basePoints: 4, activePointsOverride: 9 })).toBe(9);
  });
});
