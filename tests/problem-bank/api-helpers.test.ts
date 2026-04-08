import { describe, expect, test } from "vitest";
import { normalizeProblemRow } from "@/lib/problem-bank/api-helpers";

describe("problem-bank api helpers", () => {
  test("preserves imported dollar-delimited content for edit forms", () => {
    const normalized = normalizeProblemRow({
      id: "problem-1",
      bank_id: "bank-1",
      type: "mcq",
      difficulty: "easy",
      tags: ["algebra"],
      content_latex: "Solve for $x$: $7x + 3 = 10$",
      options_json: [
        { id: "opt_a", label: "$1$" },
        { id: "opt_b", label: "$2$" },
      ],
      answer_key_json: { correctOptionIds: ["opt_a"] },
      explanation_latex: "Subtract 3 from both sides to get $7x = 7$.",
      authoring_notes: "",
      image_path: null,
      is_deleted: false,
      created_at: "2026-04-07T00:00:00.000Z",
      updated_at: "2026-04-07T00:00:00.000Z",
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.contentLatex).toBe("Solve for $x$: $7x + 3 = 10$");
    expect(normalized?.explanationLatex).toBe("Subtract 3 from both sides to get $7x = 7$.");

    expect(normalized?.type).toBe("mcq");
    if (normalized?.type === "mcq") {
      expect(normalized.options).toEqual([
        { id: "opt_a", label: "$1$" },
        { id: "opt_b", label: "$2$" },
      ]);
    }
  });

  test("preserves text and delimiters touching inline math during edit normalization", () => {
    const normalized = normalizeProblemRow({
      id: "problem-2",
      bank_id: "bank-1",
      type: "mcq",
      difficulty: "easy",
      tags: ["number-theory"],
      content_latex: "Compute$11 \\pmod{12}$.",
      options_json: [
        { id: "opt_a", label: "Between$x$and$y$" },
        { id: "opt_b", label: "Neither" },
      ],
      answer_key_json: { correctOptionIds: ["opt_a"] },
      explanation_latex: "Between$x$and$y$, choose$y$.",
      authoring_notes: "",
      image_path: null,
      is_deleted: false,
      created_at: "2026-04-07T00:00:00.000Z",
      updated_at: "2026-04-07T00:00:00.000Z",
    });

    expect(normalized).not.toBeNull();
    expect(normalized?.contentLatex).toBe("Compute$11 \\pmod{12}$.");
    expect(normalized?.explanationLatex).toBe("Between$x$and$y$, choose$y$.");

    expect(normalized?.type).toBe("mcq");
    if (normalized?.type === "mcq") {
      expect(normalized.options).toEqual([
        { id: "opt_a", label: "Between$x$and$y$" },
        { id: "opt_b", label: "Neither" },
      ]);
    }
  });
});
