import {
  normalizeLookupValue,
  normalizeTrueFalseToken,
  normalizeWhitespace,
  parsePipeDelimitedEntries,
  toCanonicalAcceptedAnswers,
} from "./normalization";
import type {
  ProblemBankValidationError,
  ProblemOption,
  TrueFalseCanonical,
  ValidatedBankInput,
  ValidationResult,
} from "./types";

export interface BankValidationInput {
  name?: string | null;
  description?: string | null;
}

interface ValidatedMcqPayload {
  options: ProblemOption[];
  correctOptionIds: string[];
}

const ACCEPTED_ANSWER_KEYS = [
  "acceptedAnswer",
  "accepted_answer",
  "acceptedAnswers",
  "accepted_answers",
  "accepted",
  "answers",
  "answer",
  "value",
] as const;

function ok<T>(value: T): ValidationResult<T> {
  return {
    ok: true,
    value,
    errors: [],
  };
}

function fail<T>(errors: ProblemBankValidationError[]): ValidationResult<T> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

function countWords(value: string): number {
  if (!value.trim()) {
    return 0;
  }

  return value.trim().split(/\s+/).length;
}

function toScalarString(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

function toScalarStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toScalarString(item))
      .filter((item): item is string => item !== null)
      .flatMap((item) => parsePipeDelimitedEntries(item));
  }

  const scalar = toScalarString(value);
  if (scalar === null) {
    return [];
  }

  return parsePipeDelimitedEntries(scalar);
}

function validateOptionCollectionInternal(optionsInput: unknown): ValidationResult<
  ProblemOption[]
> {
  if (!Array.isArray(optionsInput)) {
    return fail([
      {
        field: "options_json",
        reason: "Options must be a JSON array.",
      },
    ]);
  }

  const errors: ProblemBankValidationError[] = [];
  const options: ProblemOption[] = [];

  optionsInput.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push({
        field: "options_json",
        reason: `Option ${index + 1} must be an object with id and label.`,
      });
      return;
    }

    const record = entry as Record<string, unknown>;
    const id =
      typeof record.id === "string" ? normalizeWhitespace(record.id) : "";
    const label =
      typeof record.label === "string" ? normalizeWhitespace(record.label) : "";

    if (!id) {
      errors.push({
        field: "options_json",
        reason: `Option ${index + 1} has an empty id.`,
      });
    }

    if (!label) {
      errors.push({
        field: "options_json",
        reason: `Option ${index + 1} has an empty label.`,
      });
    }

    if (id && label) {
      options.push({ id, label });
    }
  });

  if (options.length < 2) {
    errors.push({
      field: "options_json",
      reason: "At least 2 options are required.",
    });
  }

  const seenLabels = new Set<string>();
  for (const option of options) {
    const labelKey = normalizeLookupValue(option.label);
    if (seenLabels.has(labelKey)) {
      errors.push({
        field: "options_json",
        reason: "Option labels must be unique after trim/lowercase normalization.",
      });
      break;
    }

    seenLabels.add(labelKey);
  }

  const seenIds = new Set<string>();
  for (const option of options) {
    const idKey = normalizeLookupValue(option.id);
    if (seenIds.has(idKey)) {
      errors.push({
        field: "options_json",
        reason: "Option ids must be unique after trim/lowercase normalization.",
      });
      break;
    }

    seenIds.add(idKey);
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok(options);
}

function pickAcceptedAnswerSource(input: unknown): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return input;
  }

  const record = input as Record<string, unknown>;
  for (const key of ACCEPTED_ANSWER_KEYS) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  return input;
}

export function validateBankInput(
  input: BankValidationInput,
): ValidationResult<ValidatedBankInput> {
  const name = normalizeWhitespace(input.name ?? "");
  const description = normalizeWhitespace(input.description ?? "");
  const errors: ProblemBankValidationError[] = [];

  if (!name) {
    errors.push({
      field: "name",
      reason: "Bank name is required.",
    });
  }

  if (countWords(description) > 200) {
    errors.push({
      field: "description",
      reason: "Description must be 200 words or fewer.",
    });
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    name,
    description,
  });
}

export function validateOptionCollection(
  optionsInput: unknown,
): ValidationResult<ProblemOption[]> {
  return validateOptionCollectionInternal(optionsInput);
}

export function validateMcqOptions(
  optionsInput: unknown,
  correctOptionIdsInput: unknown,
): ValidationResult<ValidatedMcqPayload> {
  const optionValidation = validateOptionCollectionInternal(optionsInput);
  if (!optionValidation.ok || optionValidation.value === null) {
    return fail(optionValidation.errors);
  }

  const options = optionValidation.value;
  const optionIdMap = new Map<string, string>();
  for (const option of options) {
    optionIdMap.set(normalizeLookupValue(option.id), option.id);
  }

  const correctOptionIds = toCanonicalAcceptedAnswers(
    toScalarStringList(correctOptionIdsInput),
  );

  const errors: ProblemBankValidationError[] = [];

  if (correctOptionIds.length === 0) {
    errors.push({
      field: "answer_key_json",
      reason: "At least one correct option id is required for mcq.",
    });
  }

  const canonicalCorrectIds: string[] = [];
  const seen = new Set<string>();
  for (const correctOptionId of correctOptionIds) {
    const key = normalizeLookupValue(correctOptionId);
    const canonicalOptionId = optionIdMap.get(key);
    if (!canonicalOptionId) {
      errors.push({
        field: "answer_key_json",
        reason: `Correct option id \"${correctOptionId}\" does not exist in options_json.`,
      });
      continue;
    }

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    canonicalCorrectIds.push(canonicalOptionId);
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    options,
    correctOptionIds: canonicalCorrectIds,
  });
}

export function validateTrueFalseAcceptedAnswer(
  input: unknown,
): ValidationResult<TrueFalseCanonical> {
  const source = pickAcceptedAnswerSource(input);

  let scalarValue: unknown = source;
  if (Array.isArray(source)) {
    if (source.length !== 1) {
      return fail([
        {
          field: "answer_key_json",
          reason:
            "True/false accepted answers must contain exactly one value: true or false.",
        },
      ]);
    }

    scalarValue = source[0];
  }

  const scalarText = toScalarString(scalarValue);
  if (scalarText === null || !normalizeWhitespace(scalarText)) {
    return fail([
      {
        field: "answer_key_json",
        reason:
          "True/false accepted answers must contain exactly one value: true or false.",
      },
    ]);
  }

  const normalized = normalizeTrueFalseToken(scalarText);
  if (normalized === null) {
    return fail([
      {
        field: "answer_key_json",
        reason:
          "True/false accepted answers must contain exactly one value: true or false.",
      },
    ]);
  }

  return ok(normalized);
}

export function validateCanonicalAcceptedAnswers(
  input: unknown,
): ValidationResult<string[]> {
  const source = pickAcceptedAnswerSource(input);
  const candidates = toScalarStringList(source);
  const canonicalAnswers = toCanonicalAcceptedAnswers(candidates);

  if (canonicalAnswers.length === 0) {
    return fail([
      {
        field: "answer_key_json",
        reason: "At least one accepted answer is required.",
      },
    ]);
  }

  return ok(canonicalAnswers);
}
