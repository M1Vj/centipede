import {
  PROBLEM_DIFFICULTIES,
  PROBLEM_TYPES,
  type ProblemDifficulty,
  type ProblemType,
  type TrueFalseCanonical,
} from "./types";

const WHITESPACE_PATTERN = /\s+/g;

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
