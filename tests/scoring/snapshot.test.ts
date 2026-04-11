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
      logTabSwitch: true,
      offensePenalties: [
        { threshold: 3, penaltyKind: "deduction", deductionValue: 2 },
        { threshold: 1, penaltyKind: "warning", deductionValue: 0 },
      ],
      customPointsByProblemId: {
        problem_b: 2,
        problem_a: 5,
      },
    });

    expect(assertSnapshotIsImmutable(snapshot)).toBe(true);
    expect(snapshot.offensePenalties.map((rule) => rule.threshold)).toEqual([1, 3]);
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
      logTabSwitch: false,
      offensePenalties: [{ threshold: 2, penaltyKind: "deduction", deductionValue: 1 }],
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
      offensePenalties: [{ threshold: -1, penaltyKind: "deduction", deductionValue: 3 }],
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

  test("rejects shallow-frozen snapshots where nested rules remain mutable", () => {
    const shallowFrozen = Object.freeze({
      scoringMode: "difficulty",
      penaltyMode: "none",
      deductionValue: 0,
      tieBreaker: "earliest_final_submission",
      multiAttemptGradingMode: "highest_score",
      shuffleQuestions: false,
      shuffleOptions: false,
      logTabSwitch: false,
      offensePenalties: Object.freeze([
        { threshold: 1, penaltyKind: "warning", deductionValue: 0 },
      ]),
      customPointsByProblemId: Object.freeze({}),
    });

    expect(isScoringSnapshot(shallowFrozen)).toBe(false);
  });
});
