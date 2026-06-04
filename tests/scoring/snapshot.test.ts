import { describe, expect, test } from "vitest";
import {
  assertSnapshotIsImmutable,
  createImmutableScoringSnapshot,
  isScoringSnapshot,
  parseScoringSnapshotPayload,
} from "@/lib/scoring/snapshot";

describe("scoring snapshot", () => {
  test("creates immutable snapshot with sorted deterministic collections", () => {
    const snapshot = createImmutableScoringSnapshot({
      scoringMode: "custom",
      penaltyMode: "fixed_deduction",
      deductionValue: 1,
      tieBreaker: "earliest_final_submission",
      multiAttemptGradingMode: "highest_score",
      shuffleQuestions: true,
      shuffleOptions: true,
      safeExamBrowserMode: "required",
      safeExamBrowserConfigKeyHashes: ["b".repeat(64), "a".repeat(64)],
      customPointsByProblemId: {
        problem_b: 2,
        problem_a: 5,
      },
    });

    expect(assertSnapshotIsImmutable(snapshot)).toBe(true);
    expect(snapshot.safeExamBrowserConfigKeyHashes).toEqual(["a".repeat(64), "b".repeat(64)]);
    expect(Object.keys(snapshot.customPointsByProblemId)).toEqual(["problem_a", "problem_b"]);
  });

  test("parses valid payload into immutable snapshot", () => {
    const parsed = parseScoringSnapshotPayload({
      scoringMode: "difficulty",
      penaltyMode: "none",
      deductionValue: 0,
      tieBreaker: "lowest_total_time",
      multiAttemptGradingMode: "average_score",
      competitionType: "open",
      shuffleQuestions: false,
      shuffleOptions: true,
      safeExamBrowserMode: "off",
      safeExamBrowserConfigKeyHashes: [],
      customPointsByProblemId: {},
    });

    expect(parsed.ok).toBe(true);
    expect(parsed.value).not.toBeNull();
    expect(parsed.value ? assertSnapshotIsImmutable(parsed.value) : false).toBe(true);
    expect(isScoringSnapshot(parsed.value)).toBe(true);
  });

  test("rejects invalid payload with field errors", () => {
    const parsed = parseScoringSnapshotPayload({
      penaltyMode: "fixed_deduction",
      deductionValue: -10,
    });

    expect(parsed.ok).toBe(false);
    expect(parsed.value).toBeNull();
    expect(parsed.errors.length).toBeGreaterThan(0);
    expect(isScoringSnapshot(parsed.value)).toBe(false);
  });

  test("rejects payloads that omit required snapshot keys", () => {
    const parsed = parseScoringSnapshotPayload({});

    expect(parsed.ok).toBe(false);
    expect(parsed.value).toBeNull();
    expect(parsed.errors.some((error) => error.field === "snapshot")).toBe(true);
  });

  test("rejects shallow-frozen snapshots where nested collections remain mutable", () => {
    const shallowFrozen = Object.freeze({
      scoringMode: "difficulty",
      penaltyMode: "none",
      deductionValue: 0,
      tieBreaker: "earliest_final_submission",
      multiAttemptGradingMode: "highest_score",
      shuffleQuestions: false,
      shuffleOptions: false,
      safeExamBrowserMode: "off",
      safeExamBrowserConfigKeyHashes: Object.freeze([]),
      customPointsByProblemId: { problem_a: 1 },
    });

    expect(isScoringSnapshot(shallowFrozen)).toBe(false);
  });
});
