import { describe, expect, test } from "vitest";
import { validateProblemDraft } from "@/components/problem-bank/problem-form";

describe("ProblemForm validation logic", () => {
  test("rejects mcq options with duplicate labels before submit", () => {
    const result = validateProblemDraft({
      type: "mcq",
      difficulty: "easy",
      tags: "algebra",
      contentLatex: "x + 1 = 2",
      explanationLatex: "Subtract 1",
      authoringNotes: "",
      imagePath: null,
      options: [
        { id: "opt_a", label: " Choice " },
        { id: "opt_b", label: "choice" },
      ],
      answerKey: { correctOptionIds: ["opt_a"] },
    });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.reason.includes("Option labels must be unique"),
      ),
    ).toBe(true);
  });

  test("normalizes canonical accepted answers for numeric problems", () => {
    const result = validateProblemDraft({
      type: "numeric",
      difficulty: "average",
      tags: "numbers",
      contentLatex: "2+2",
      explanationLatex: "",
      authoringNotes: "",
      imagePath: null,
      options: null,
      answerKey: " 4 | 4 | 04 ",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.answerKey).toEqual({
      acceptedAnswers: ["4", "04"],
    });
  });
});
