import type { ProblemType } from "@/lib/problem-bank/types";
import type { NormalizedScoringAnswer } from "./types";

const WHITESPACE_PATTERN = /\s+/g;
const LATEX_SPACING_COMMAND_PATTERN = /\\(?:,|;|:|!|quad|qquad| )/g;

const TRUE_FALSE_NORMALIZATION_MAP: Record<string, "true" | "false"> = {
  true: "true",
  t: "true",
  yes: "true",
  y: "true",
  "1": "true",
  false: "false",
  f: "false",
  no: "false",
  n: "false",
  "0": "false",
};

export function normalizeWhitespace(value: string): string {
  return value.replace(WHITESPACE_PATTERN, " ").trim();
}

function unwrapOuterMathDelimiters(value: string): string {
  let normalized = value.trim();

  while (normalized.startsWith("$") && normalized.endsWith("$")) {
    const hasDoubleDelimiters = normalized.startsWith("$$") && normalized.endsWith("$$");
    const delimiterSize = hasDoubleDelimiters ? 2 : 1;
    const inner = normalized.slice(delimiterSize, -delimiterSize).trim();

    if (!inner || inner.includes("$")) {
      break;
    }

    normalized = inner;
  }

  return normalized;
}

export function normalizeLatexText(value: string): string {
  const withoutOuterDelimiters = unwrapOuterMathDelimiters(value);
  const withoutSpacingCommands = withoutOuterDelimiters.replace(
    LATEX_SPACING_COMMAND_PATTERN,
    "",
  );

  return normalizeWhitespace(withoutSpacingCommands);
}

export function normalizeMcqAnswerToken(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeTrueFalseToken(value: string): "true" | "false" | null {
  const normalized = normalizeWhitespace(value).toLowerCase();
  return TRUE_FALSE_NORMALIZATION_MAP[normalized] ?? null;
}

function parseSimpleFraction(value: string): number | null {
  const fractionMatch = value.match(
    /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\/([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/,
  );

  if (!fractionMatch) {
    return null;
  }

  const numerator = Number.parseFloat(fractionMatch[1]);
  const denominator = Number.parseFloat(fractionMatch[2]);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function parseLatexFraction(value: string): number | null {
  const fractionMatch = value.match(
    /^\\frac\{([+-]?(?:\d+(?:\.\d+)?|\.\d+))\}\{([+-]?(?:\d+(?:\.\d+)?|\.\d+))\}$/,
  );

  if (!fractionMatch) {
    return null;
  }

  const numerator = Number.parseFloat(fractionMatch[1]);
  const denominator = Number.parseFloat(fractionMatch[2]);

  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function stripOuterParentheses(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

export function parseNumericLatex(value: string): number | null {
  const normalized = normalizeLatexText(value)
    .replace(/,/g, "")
    .replace(/\s+/g, "");

  if (!normalized) {
    return null;
  }

  const withoutParentheses = stripOuterParentheses(normalized);

  const latexFraction = parseLatexFraction(withoutParentheses);
  if (latexFraction !== null) {
    return latexFraction;
  }

  const simpleFraction = parseSimpleFraction(withoutParentheses);
  if (simpleFraction !== null) {
    return simpleFraction;
  }

  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(withoutParentheses)) {
    return null;
  }

  const numericValue = Number.parseFloat(withoutParentheses);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function normalizeIdentificationAnswer(value: string): string {
  return normalizeLatexText(value).toLowerCase();
}

export function areNumericAnswersEquivalent(
  expectedNumericValue: number | null,
  actualNumericValue: number | null,
  tolerance = 1e-9,
): boolean {
  if (
    expectedNumericValue === null ||
    actualNumericValue === null ||
    !Number.isFinite(expectedNumericValue) ||
    !Number.isFinite(actualNumericValue) ||
    !Number.isFinite(tolerance)
  ) {
    return false;
  }

  return Math.abs(expectedNumericValue - actualNumericValue) <= Math.abs(tolerance);
}

export function normalizeAnswerForScoring(
  problemType: ProblemType,
  rawAnswerValue: string | null | undefined,
): NormalizedScoringAnswer {
  const source = typeof rawAnswerValue === "string" ? rawAnswerValue : "";

  if (problemType === "mcq") {
    return {
      problemType,
      normalizedText: normalizeMcqAnswerToken(source),
      normalizedTrueFalse: null,
      normalizedNumeric: null,
    };
  }

  if (problemType === "tf") {
    const normalizedTrueFalse = normalizeTrueFalseToken(source);
    return {
      problemType,
      normalizedText: normalizedTrueFalse ?? normalizeMcqAnswerToken(source),
      normalizedTrueFalse,
      normalizedNumeric: null,
    };
  }

  if (problemType === "numeric") {
    const normalizedNumeric = parseNumericLatex(source);
    return {
      problemType,
      normalizedText: normalizeLatexText(source),
      normalizedTrueFalse: null,
      normalizedNumeric,
    };
  }

  return {
    problemType,
    normalizedText: normalizeIdentificationAnswer(source),
    normalizedTrueFalse: null,
    normalizedNumeric: null,
  };
}
