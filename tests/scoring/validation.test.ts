import { describe, expect, test } from "vitest";
import {
  createDefaultScoringRuleConfig,
  normalizeAttemptGradingModeToken,
  normalizePenaltyModeToken,
  normalizeScoringModeToken,
  normalizeTieBreakerToken,
  validateScoringRuleInput,
} from "@/lib/scoring/validation";

describe("scoring validation", () => {
  test("returns sane defaults", () => {
    expect(createDefaultScoringRuleConfig()).toEqual({
      scoringMode: "difficulty",
      penaltyMode: "none",
      deductionValue: 0,
      tieBreaker: "earliest_final_submission",
      multiAttemptGradingMode: "highest_score",
      shuffleQuestions: false,
      shuffleOptions: false,
      logTabSwitch: false,
      offensePenalties: [],
      safeExamBrowserMode: "off",
      safeExamBrowserConfigKeyHashes: [],
      customPointsByProblemId: {},
    });
  });

  test("normalizes known alias tokens", () => {
    expect(normalizeScoringModeToken("automatic")).toBe("difficulty");
    expect(normalizePenaltyModeToken("deduction")).toBe("fixed_deduction");
    expect(normalizeTieBreakerToken("average_time")).toBe("lowest_total_time");
    expect(normalizeAttemptGradingModeToken("average_score")).toBe("average_score");
  });

  test("validates custom scoring with penalties and offense rules", () => {
    const result = validateScoringRuleInput({
      scoringMode: "custom",
      penaltyMode: "fixed_deduction",
      deductionValue: 2,
      tieBreaker: "lowest_total_time",
      multiAttemptGradingMode: "average_score",
      competitionType: "open",
      shuffleQuestions: "true",
      shuffleOptions: true,
      logTabSwitch: false,
      offensePenalties: [
        { threshold: 2, penaltyKind: "deduction", deductionValue: 1 },
        { threshold: 1, penaltyKind: "warning", deductionValue: 0 },
      ],
      customPointsByProblemId: {
        cp2: "8",
        cp1: 4,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      scoringMode: "custom",
      penaltyMode: "fixed_deduction",
      deductionValue: 2,
      tieBreaker: "lowest_total_time",
      multiAttemptGradingMode: "average_score",
      shuffleQuestions: true,
      shuffleOptions: true,
      logTabSwitch: false,
      offensePenalties: [
        { threshold: 1, penaltyKind: "warning", deductionValue: 0 },
        { threshold: 2, penaltyKind: "deduction", deductionValue: 1 },
      ],
      safeExamBrowserMode: "off",
      safeExamBrowserConfigKeyHashes: [],
      customPointsByProblemId: {
        cp1: 4,
        cp2: 8,
      },
    });
  });

  test("rejects invalid scheduled attempt mode and missing custom points", () => {
    const result = validateScoringRuleInput({
      scoringMode: "custom",
      competitionType: "scheduled",
      multiAttemptGradingMode: "latest_score",
      customPointsByProblemId: {},
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.field === "multiAttemptGradingMode")).toBe(true);
    expect(result.errors.some((error) => error.field === "customPointsByProblemId")).toBe(true);
  });

  test("rejects invalid offense penalty definitions", () => {
    const result = validateScoringRuleInput({
      offensePenalties: [{ threshold: 1, penaltyKind: "deduction", deductionValue: 0 }],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.field === "offensePenalties")).toBe(true);
  });
});
