import {
  PROBLEM_DIFFICULTIES,
  PROBLEM_TYPES,
  type ProblemDifficulty,
  type ProblemType,
  type TrueFalseCanonical,
} from "./types";

const WHITESPACE_PATTERN = /\s+/g;

interface DollarDelimitedSegment {
  inMath: boolean;
  value: string;
}

const OPENING_PUNCTUATION_PATTERN = /[([{]$/;
const CLOSING_PUNCTUATION_PATTERN = /^[)\]}.,;:!?]/;
const OPERATOR_PATTERN = /^[+\-*/=^_%<>|&]/;

const TRUE_FALSE_NORMALIZATION_MAP: Record<string, TrueFalseCanonical> = {
  true: "true",
  t: "true",
  yes: "true",
  y: "true",
  1: "true",
  false: "false",
  f: "false",
  no: "false",
  n: "false",
  0: "false",
};

export function normalizeWhitespace(value: string): string {
  return value.replace(WHITESPACE_PATTERN, " ").trim();
}

function splitBalancedDollarSegments(value: string): DollarDelimitedSegment[] | null {
  const segments: DollarDelimitedSegment[] = [];
  let buffer = "";
  let inMath = false;
  let sawDelimiter = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = index > 0 ? value[index - 1] : "";

    if (character === "$" && previousCharacter !== "\\") {
      sawDelimiter = true;
      segments.push({
        inMath,
        value: buffer,
      });
      buffer = "";
      inMath = !inMath;
      continue;
    }

    buffer += character;
  }

  if (!sawDelimiter || inMath) {
    return null;
  }

  segments.push({
    inMath,
    value: buffer,
  });

  return segments;
}

function shouldInsertSpaceBetweenSegments(
  previousSegmentValue: string,
  nextSegmentValue: string,
): boolean {
  if (!previousSegmentValue || !nextSegmentValue) {
    return false;
  }

  const previousCharacter = previousSegmentValue[previousSegmentValue.length - 1] ?? "";
  const nextCharacter = nextSegmentValue[0] ?? "";

  if (!previousCharacter || !nextCharacter) {
    return false;
  }

  if (/\s/.test(previousCharacter) || /\s/.test(nextCharacter)) {
    return false;
  }

  if (OPENING_PUNCTUATION_PATTERN.test(previousCharacter)) {
    return false;
  }

  if (CLOSING_PUNCTUATION_PATTERN.test(nextCharacter)) {
    return false;
  }

  if (OPERATOR_PATTERN.test(previousCharacter) || OPERATOR_PATTERN.test(nextCharacter)) {
    return false;
  }

  return true;
}

export function stripBalancedMathDelimiters(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.includes("$")) {
    return trimmed;
  }

  const displayWrapped = trimmed.match(/^\$\$([\s\S]*)\$\$$/);
  if (displayWrapped) {
    return displayWrapped[1].trim();
  }

  const segments = splitBalancedDollarSegments(trimmed);
  if (!segments) {
    return trimmed;
  }

  const mergedSegments = segments.reduce((result, segment, index) => {
    if (index === 0) {
      return segment.value;
    }

    const previousSegment = segments[index - 1];
    const separator = shouldInsertSpaceBetweenSegments(
      previousSegment?.value ?? "",
      segment.value,
    )
      ? " "
      : "";

    return `${result}${separator}${segment.value}`;
  }, "");

  return mergedSegments.trim();
}

export function normalizeLookupValue(value: string): string {
  return normalizeWhitespace(value).toLowerCase();
}

export function normalizeProblemType(value: string): ProblemType | null {
  const normalized = normalizeLookupValue(value);
  if (!PROBLEM_TYPES.includes(normalized as ProblemType)) {
    return null;
  }

  return normalized as ProblemType;
}

export function normalizeProblemDifficulty(value: string): ProblemDifficulty | null {
  const normalized = normalizeLookupValue(value);
  if (!PROBLEM_DIFFICULTIES.includes(normalized as ProblemDifficulty)) {
    return null;
  }

  return normalized as ProblemDifficulty;
}

export function parsePipeDelimitedEntries(value: string): string[] {
  if (!value.trim()) {
    return [];
  }

  return value
    .split("|")
    .map((entry) => normalizeWhitespace(entry))
    .filter((entry) => entry.length > 0);
}

export function parsePipeDelimitedTags(value: string): string[] {
  const entries = parsePipeDelimitedEntries(value);
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const entry of entries) {
    const key = entry.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(entry);
  }

  return tags;
}

export function toCanonicalAcceptedAnswers(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of values) {
    const cleaned = normalizeWhitespace(value);
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(cleaned);
  }

  return normalized;
}

export function normalizeTrueFalseToken(value: string): TrueFalseCanonical | null {
  const normalized = normalizeLookupValue(value);
  return TRUE_FALSE_NORMALIZATION_MAP[normalized] ?? null;
}
