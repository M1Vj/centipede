import { describe, expect, test } from "vitest";
import {
  buildAttemptReviewRows,
  countReviewStatuses,
  getResultPolicyCopy,
} from "@/lib/submission/summary";
import type { AnswerStatusFlag } from "@/lib/arena/types";

const problems = [
  { competitionProblemId: "cp-1", orderIndex: 1, points: 10 },
  { competitionProblemId: "cp-2", orderIndex: 2, points: 15 },
  { competitionProblemId: "cp-3", orderIndex: 3, points: 20 },
  { competitionProblemId: "cp-4", orderIndex: 4, points: null },
];

function answer(competitionProblemId: string, statusFlag: AnswerStatusFlag) {
  return {
    id: `answer-${competitionProblemId}`,
    attemptId: "attempt-1",
    competitionProblemId,
    answerLatex: "",
    answerTextNormalized: "",
    statusFlag,
    lastSavedAt: "2026-05-01T00:00:00.000Z",
    clientUpdatedAt: "2026-05-01T00:00:00.000Z",
  };
}

describe("submission summary helpers", () => {
  test("counts persisted answer status flags and infers missing rows as blank", () => {
    const rows = buildAttemptReviewRows({
      problems,
      answers: [answer("cp-1", "filled"), answer("cp-2", "solved"), answer("cp-3", "reset")],
    });

    expect(rows.map((row) => [row.problemNumber, row.statusFlag])).toEqual([
      [1, "filled"],
      [2, "solved"],
      [3, "reset"],
      [4, "blank"],
    ]);
    expect(countReviewStatuses(rows)).toEqual({
      total: 4,
      blank: 1,
      filled: 1,
      solved: 1,
      reset: 1,
      answered: 2,
    });
  });

  test("uses deterministic result copy for supported multi-attempt policies", () => {
    expect(getResultPolicyCopy("highest_score")).toContain("highest score");
    expect(getResultPolicyCopy("latest_score")).toContain("latest attempt");
    expect(getResultPolicyCopy("average_score")).toContain("average");
  });
});
