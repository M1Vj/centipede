import { describe, expect, test } from "vitest";
import {
  canParticipantViewAnswerKey,
  createReviewSummary,
  normalizeDisputeReason,
} from "@/lib/submission/helpers";

describe("submission domain helpers", () => {
  test("counts persisted answer status flags and infers missing rows as blank", () => {
    const summary = createReviewSummary({
      competitionProblemIds: ["p1", "p2", "p3", "p4", "p5"],
      answers: [
        { competitionProblemId: "p1", statusFlag: "filled" },
        { competitionProblemId: "p2", statusFlag: "solved" },
        { competitionProblemId: "p3", statusFlag: "reset" },
      ],
    });

    expect(summary).toEqual({
      total: 5,
      blank: 2,
      filled: 1,
      solved: 1,
      reset: 1,
      answered: 2,
      missingRowsInferredBlank: 2,
    });
  });

  test("deduplicates duplicate answer rows before blank inference", () => {
    const summary = createReviewSummary({
      competitionProblemIds: ["p1", "p2"],
      answers: [
        { competitionProblemId: "p1", statusFlag: "filled" },
        { competitionProblemId: "p1", statusFlag: "solved" },
      ],
    });

    expect(summary).toMatchObject({
      total: 2,
      blank: 1,
      filled: 1,
      solved: 0,
      missingRowsInferredBlank: 1,
    });
  });

  test("allows answer keys only for participant context after trusted end when visibility is after_end", () => {
    expect(
      canParticipantViewAnswerKey({
        answerKeyVisibility: "after_end",
        competitionStatus: "ended",
        hasParticipantContext: true,
        hasTrustedEnd: true,
      }),
    ).toBe(true);

    expect(
      canParticipantViewAnswerKey({
        answerKeyVisibility: "after_end",
        competitionStatus: "ended",
        hasParticipantContext: true,
        hasTrustedEnd: false,
      }),
    ).toBe(false);

    expect(
      canParticipantViewAnswerKey({
        answerKeyVisibility: "hidden",
        competitionStatus: "archived",
        hasParticipantContext: true,
        hasTrustedEnd: true,
      }),
    ).toBe(false);
  });

  test("normalizes dispute reason without exposing empty or abusive payloads", () => {
    expect(normalizeDisputeReason("  Answer key seems wrong.\nPlease review.  ")).toBe(
      "Answer key seems wrong. Please review.",
    );
    expect(normalizeDisputeReason("")).toBeNull();
    expect(normalizeDisputeReason("x".repeat(1201))).toHaveLength(1000);
  });
});
