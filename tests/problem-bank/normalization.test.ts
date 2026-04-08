import { describe, expect, test } from "vitest";
import {
  normalizeProblemDifficulty,
  normalizeProblemType,
  normalizeTrueFalseToken,
  normalizeWhitespace,
  parsePipeDelimitedTags,
  stripBalancedMathDelimiters,
  toCanonicalAcceptedAnswers,
} from "@/lib/problem-bank/normalization";

describe("problem-bank normalization", () => {
  test("normalizes whitespace by trimming and collapsing runs", () => {
    expect(normalizeWhitespace("   alpha   beta\n\tgamma   ")).toBe(
      "alpha beta gamma",
    );
  });

  test("canonicalizes accepted answers with case-insensitive dedupe and stable order", () => {
    const result = toCanonicalAcceptedAnswers([
      "  Alpha  ",
      "alpha",
      "ALPHA",
      "Beta",
      " beta ",
      "Gamma",
    ]);

    expect(result).toEqual(["Alpha", "Beta", "Gamma"]);
  });

  test("normalizes true/false variants", () => {
    expect(normalizeTrueFalseToken("YES")).toBe("true");
    expect(normalizeTrueFalseToken(" t ")).toBe("true");
    expect(normalizeTrueFalseToken("0")).toBe("false");
    expect(normalizeTrueFalseToken("No")).toBe("false");
    expect(normalizeTrueFalseToken("maybe")).toBeNull();
  });

  test("parses tags as pipe-delimited entries", () => {
    const tags = parsePipeDelimitedTags(" Algebra |geometry| algebra |GEOMETRY| ");
    expect(tags).toEqual(["Algebra", "geometry"]);
  });

  test("normalizes problem type and difficulty values", () => {
    expect(normalizeProblemType(" MCQ ")).toBe("mcq");
    expect(normalizeProblemType("IDENTIFICATION")).toBe("identification");
    expect(normalizeProblemType("essay")).toBeNull();

    expect(normalizeProblemDifficulty(" EASY ")).toBe("easy");
    expect(normalizeProblemDifficulty("Difficult")).toBe("difficult");
    expect(normalizeProblemDifficulty("hard")).toBeNull();
  });

  test("strips balanced dollar math delimiters from inline math text", () => {
    expect(stripBalancedMathDelimiters("Solve for $x$: $7x + 3 = 10$")).toBe(
      "Solve for x: 7x + 3 = 10",
    );
    expect(stripBalancedMathDelimiters("$16 \\pmod{12}$")).toBe("16 \\pmod{12}");
  });

  test("preserves readable spacing when inline math delimiters touch text", () => {
    expect(stripBalancedMathDelimiters("Compute$11 \\pmod{12}$.")).toBe(
      "Compute 11 \\pmod{12}.",
    );
    expect(stripBalancedMathDelimiters("Between$x$and$y$, choose$y$."))
      .toBe("Between x and y, choose y.");
  });

  test("preserves unmatched dollar delimiters", () => {
    expect(stripBalancedMathDelimiters("Price is $5")).toBe("Price is $5");
  });
});
