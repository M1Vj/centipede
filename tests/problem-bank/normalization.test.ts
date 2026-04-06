import { describe, expect, test } from "vitest";
import {
  normalizeProblemDifficulty,
  normalizeProblemType,
  normalizeTrueFalseToken,
  normalizeWhitespace,
  parsePipeDelimitedTags,
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
});
