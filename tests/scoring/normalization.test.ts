import { describe, expect, test } from "vitest";
import {
  areNumericAnswersEquivalent,
  normalizeAnswerForScoring,
  normalizeMcqAnswerToken,
  normalizeTrueFalseToken,
  parseNumericLatex,
} from "@/lib/scoring/normalization";

describe("scoring normalization", () => {
  test("normalizes mcq tokens with trim + case folding", () => {
    expect(normalizeMcqAnswerToken("  Opt_A  ")).toBe("opt_a");
    expect(normalizeMcqAnswerToken("\n  Choice\tB \r\n")).toBe("choice b");
  });

  test("normalizes true/false variants", () => {
    expect(normalizeTrueFalseToken("YES")).toBe("true");
    expect(normalizeTrueFalseToken("   TrUe   ")).toBe("true");
    expect(normalizeTrueFalseToken("0")).toBe("false");
    expect(normalizeTrueFalseToken("maybe")).toBeNull();
  });

  test("parses numeric latex from decimals and fractions", () => {
    expect(parseNumericLatex("0.5")).toBe(0.5);
    expect(parseNumericLatex("1/2")).toBe(0.5);
    expect(parseNumericLatex("\\frac{1}{2}")).toBe(0.5);
    expect(parseNumericLatex("$1,000$")).toBe(1000);
    expect(parseNumericLatex("$$ 1,200.50 $$")).toBe(1200.5);
    expect(parseNumericLatex("( 1/4 )")).toBe(0.25);
    expect(parseNumericLatex("\\frac{ 10 }{ 4 }")).toBe(2.5);
    expect(parseNumericLatex("1e-3")).toBe(0.001);
    expect(parseNumericLatex("abc")).toBeNull();
  });

  test("compares numeric values with tolerance", () => {
    expect(areNumericAnswersEquivalent(0.3, 0.3000000004)).toBe(true);
    expect(areNumericAnswersEquivalent(0.3, 0.3001)).toBe(false);
    expect(areNumericAnswersEquivalent(null, 0.3)).toBe(false);
  });

  test("normalizes identification answers via latex-aware text normalization", () => {
    const normalized = normalizeAnswerForScoring("identification", "  $  Alpha   Beta $ ");
    expect(normalized.normalizedText).toBe("alpha beta");
    expect(normalized.normalizedNumeric).toBeNull();

    const spaced = normalizeAnswerForScoring("identification", "\\quad Alpha\\,Beta ");
    expect(spaced.normalizedText).toBe("alphabeta");
  });

  test("normalizes numeric answer payload in normalizeAnswerForScoring", () => {
    const normalized = normalizeAnswerForScoring("numeric", "\\frac{3}{4}");
    expect(normalized.normalizedNumeric).toBe(0.75);
  });
});
