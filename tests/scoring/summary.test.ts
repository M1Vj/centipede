import { describe, expect, test } from "vitest";
import { buildScoringSummaryView } from "@/lib/scoring/summary";

describe("scoring summary", () => {
  test("builds wizard summary with custom-points detail", () => {
    const summary = buildScoringSummaryView(
      {
        scoringMode: "custom",
        penaltyMode: "fixed_deduction",
        deductionValue: 2,
        tieBreaker: "lowest_total_time",
        multiAttemptGradingMode: "highest_score",
        shuffleQuestions: true,
        shuffleOptions: false,
        logTabSwitch: true,
        offensePenalties: [],
        customPointsByProblemId: {
          p1: 5,
          p2: 8,
        },
      },
      "wizard",
      {
        competitionType: "open",
        selectedProblemCount: 3,
      },
    );

    expect(summary.title).toBe("Scoring summary");
    expect(summary.description).toContain("immutable after publish");
    expect(summary.lines.some((line) => line.label === "Custom points configured")).toBe(true);
    expect(summary.lines.some((line) => line.value === "2 of 3 problem(s)")).toBe(true);
    expect(summary.notices).toEqual([]);
  });

  test("adds review notices for average score and penalty floor", () => {
    const summary = buildScoringSummaryView(
      {
        scoringMode: "difficulty",
        penaltyMode: "none",
        deductionValue: 0,
        tieBreaker: "earliest_final_submission",
        multiAttemptGradingMode: "average_score",
        shuffleQuestions: false,
        shuffleOptions: false,
        logTabSwitch: false,
        offensePenalties: [],
        customPointsByProblemId: {},
      },
      "review",
      {
        competitionType: "open",
      },
    );

    expect(summary.title).toBe("How your score is computed");
    expect(summary.notices).toContain(
      "Average score is computed once from graded final scores and rounded to 2 decimals.",
    );
    expect(summary.notices).toContain(
      "Penalties are applied with a zero floor, so final score never drops below zero.",
    );
  });

  test("uses scheduled single-attempt label when competition is not open", () => {
    const summary = buildScoringSummaryView(
      {
        scoringMode: "difficulty",
        penaltyMode: "none",
        deductionValue: 0,
        tieBreaker: "earliest_final_submission",
        multiAttemptGradingMode: "latest_score",
        shuffleQuestions: false,
        shuffleOptions: false,
        logTabSwitch: false,
        offensePenalties: [],
        customPointsByProblemId: {},
      },
      "wizard",
      {
        competitionType: "scheduled",
      },
    );

    const attemptLine = summary.lines.find((line) => line.label === "Attempt policy");
    expect(attemptLine?.value).toBe("Highest score (single-attempt scheduled mode)");
  });

  test("falls back to configured attempt mode when competition type is omitted", () => {
    const summary = buildScoringSummaryView(
      {
        scoringMode: "difficulty",
        penaltyMode: "none",
        deductionValue: 0,
        tieBreaker: "earliest_final_submission",
        multiAttemptGradingMode: "average_score",
        shuffleQuestions: false,
        shuffleOptions: false,
        logTabSwitch: false,
        offensePenalties: [],
        customPointsByProblemId: {},
      },
      "review",
    );

    const attemptLine = summary.lines.find((line) => line.label === "Attempt policy");
    expect(attemptLine?.value).toBe("Average score");
  });
});
