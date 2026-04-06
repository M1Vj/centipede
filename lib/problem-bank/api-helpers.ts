import {
  normalizeProblemDifficulty,
  normalizeProblemType,
  normalizeTrueFalseToken,
  normalizeWhitespace,
  parsePipeDelimitedTags,
  toCanonicalAcceptedAnswers,
} from "@/lib/problem-bank/normalization";
import {
  validateCanonicalAcceptedAnswers,
  validateMcqOptions,
  validateOptionCollection,
  validateTrueFalseAcceptedAnswer,
} from "@/lib/problem-bank/validation";
import type {
  McqAnswerKey,
  MultiValueAnswerKey,
  ProblemBankValidationError,
  ProblemDifficulty,
  ProblemOption,
  ProblemType,
  TrueFalseAnswerKey,
  ValidationResult,
} from "@/lib/problem-bank/types";

type UnknownRecord = Record<string, unknown>;

export type ProblemBankActorRole = "mathlete" | "organizer" | "admin";

export interface ProblemBankActorContext {
  userId: string;
  role: ProblemBankActorRole;
  isActive: boolean;
}

export interface ProblemBankRecord {
  id: string;
  organizerId: string;
  name: string;
  description: string;
  isDefaultBank: boolean;
  isVisibleToOrganizers: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NormalizedProblemAnswerKey =
  | McqAnswerKey
  | TrueFalseAnswerKey
  | MultiValueAnswerKey;

export interface ProblemRecord {
  id: string;
  bankId: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  isDeleted: boolean;
  tags: string[];
  contentLatex: string;
  explanationLatex: string;
  authoringNotes: string;
  imagePath: string | null;
  options: ProblemOption[] | null;
  answerKey: NormalizedProblemAnswerKey;
  createdAt: string;
  updatedAt: string;
}

export interface ProblemWriteInput {
  type?: unknown;
  difficulty?: unknown;
  tags?: unknown;
  contentLatex?: unknown;
  explanationLatex?: unknown;
  authoringNotes?: unknown;
  imagePath?: unknown;
  options?: unknown;
  answerKey?: unknown;
}

export interface ValidatedProblemWriteInput {
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tags: string[];
  contentLatex: string;
  explanationLatex: string;
  authoringNotes: string;
  imagePath: string | null;
  options: ProblemOption[] | null;
  answerKey: NormalizedProblemAnswerKey;
}

export interface SafeDatabaseError {
  code: string;
  message: string;
  status: number;
}

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

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => normalizeWhitespace(entry))
      .filter((entry) => entry.length > 0);
  }

  if (typeof value === "string") {
    return parsePipeDelimitedTags(value);
  }

  return [];
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function extractCorrectOptionIds(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input;
  }

  const record = asRecord(input);
  if (!record) {
    return input;
  }

  if (record.correctOptionIds !== undefined) {
    return record.correctOptionIds;
  }

  if (record.correct_option_ids !== undefined) {
    return record.correct_option_ids;
  }

  if (record.correct !== undefined) {
    return record.correct;
  }

  if (record.answer !== undefined) {
    return record.answer;
  }

  return [];
}

function normalizeOptionList(value: unknown): ProblemOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const options: ProblemOption[] = [];
  for (const entry of value) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }

    const id = normalizeWhitespace(readString(record, "id"));
    const label = normalizeWhitespace(readString(record, "label"));
    if (!id || !label) {
      continue;
    }

    options.push({ id, label });
  }

  return options;
}

function normalizeMcqAnswerKey(value: unknown): McqAnswerKey {
  const ids = toCanonicalAcceptedAnswers(
    readStringArray(extractCorrectOptionIds(parseJsonIfString(value))),
  );

  return {
    correctOptionIds: ids,
  };
}

function normalizeTrueFalseAnswerKey(value: unknown): TrueFalseAnswerKey {
  const validation = validateTrueFalseAcceptedAnswer(parseJsonIfString(value));

  if (validation.ok && validation.value) {
    return { acceptedAnswer: validation.value };
  }

  const fallback = normalizeTrueFalseToken(String(value ?? "")) ?? "true";
  return { acceptedAnswer: fallback };
}

function normalizeAcceptedAnswers(value: unknown): MultiValueAnswerKey {
  const validation = validateCanonicalAcceptedAnswers(parseJsonIfString(value));

  if (validation.ok && validation.value) {
    return { acceptedAnswers: validation.value };
  }

  return {
    acceptedAnswers: toCanonicalAcceptedAnswers(readStringArray(value)),
  };
}

export function normalizeTagsInput(value: unknown): string[] {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    const tags: string[] = [];

    value.forEach((entry) => {
      if (typeof entry !== "string") {
        return;
      }

      const tag = normalizeWhitespace(entry);
      if (!tag) {
        return;
      }

      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      tags.push(tag);
    });

    return tags;
  }

  if (typeof value === "string") {
    return parsePipeDelimitedTags(value);
  }

  return [];
}

export function normalizeProblemBankRow(row: unknown): ProblemBankRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  const organizerId = readString(record, "organizer_id");
  const createdAt = readString(record, "created_at");
  const updatedAt = readString(record, "updated_at") || createdAt;

  if (!id || !organizerId) {
    return null;
  }

  return {
    id,
    organizerId,
    name: normalizeWhitespace(readString(record, "name")),
    description: normalizeWhitespace(readString(record, "description")),
    isDefaultBank: Boolean(record.is_default_bank),
    isVisibleToOrganizers: Boolean(record.is_visible_to_organizers),
    isDeleted: Boolean(record.is_deleted),
    createdAt,
    updatedAt,
  };
}

export function normalizeProblemRow(row: unknown): ProblemRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  const bankId = readString(record, "bank_id");
  const createdAt = readString(record, "created_at");
  const updatedAt = readString(record, "updated_at") || createdAt;

  const type = normalizeProblemType(readString(record, "type"));
  const difficulty = normalizeProblemDifficulty(readString(record, "difficulty"));

  if (!id || !bankId || type === null || difficulty === null) {
    return null;
  }

  const contentLatex =
    normalizeWhitespace(readString(record, "content_latex")) ||
    normalizeWhitespace(readString(record, "content"));

  const optionsSource = record.options_json ?? record.options ?? null;
  const answerKeySource = record.answer_key_json ?? record.answers ?? null;

  let answerKey: NormalizedProblemAnswerKey;
  if (type === "mcq") {
    answerKey = normalizeMcqAnswerKey(answerKeySource);
  } else if (type === "tf") {
    answerKey = normalizeTrueFalseAnswerKey(answerKeySource);
  } else {
    answerKey = normalizeAcceptedAnswers(answerKeySource);
  }

  const options =
    type === "mcq" || type === "tf"
      ? normalizeOptionList(parseJsonIfString(optionsSource))
      : null;

  return {
    id,
    bankId,
    type,
    difficulty,
    isDeleted: Boolean(record.is_deleted),
    tags: normalizeTagsInput(record.tags),
    contentLatex,
    explanationLatex: normalizeWhitespace(readString(record, "explanation_latex")),
    authoringNotes: normalizeWhitespace(readString(record, "authoring_notes")),
    imagePath:
      normalizeWhitespace(readString(record, "image_path")) ||
      normalizeWhitespace(readString(record, "image_url")) ||
      null,
    options,
    answerKey,
    createdAt,
    updatedAt,
  };
}

export function canMutateBank(
  actor: ProblemBankActorContext,
  bank: ProblemBankRecord,
): boolean {
  if (bank.isDeleted) {
    return false;
  }

  if (actor.role === "admin") {
    return bank.isDefaultBank;
  }

  if (actor.role === "organizer") {
    return actor.userId === bank.organizerId && !bank.isDefaultBank;
  }

  return false;
}

export function canViewBank(
  actor: ProblemBankActorContext,
  bank: ProblemBankRecord,
): boolean {
  if (bank.isDeleted) {
    return false;
  }

  if (actor.role === "admin") {
    return true;
  }

  if (actor.role === "organizer") {
    if (actor.userId === bank.organizerId) {
      return true;
    }

    return bank.isDefaultBank && bank.isVisibleToOrganizers;
  }

  return false;
}

export function normalizeExpectedUpdatedAt(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function validateProblemWriteInput(
  input: ProblemWriteInput,
): ValidationResult<ValidatedProblemWriteInput> {
  const type = normalizeProblemType(String(input.type ?? ""));
  const difficulty = normalizeProblemDifficulty(String(input.difficulty ?? ""));

  const contentLatex = normalizeWhitespace(String(input.contentLatex ?? ""));
  const explanationLatex = normalizeWhitespace(String(input.explanationLatex ?? ""));
  const authoringNotes = normalizeWhitespace(String(input.authoringNotes ?? ""));
  const imagePath = normalizeWhitespace(String(input.imagePath ?? "")) || null;
  const tags = normalizeTagsInput(input.tags);

  const errors: ProblemBankValidationError[] = [];

  if (type === null) {
    errors.push({
      field: "type",
      reason: "Problem type is invalid.",
    });
  }

  if (difficulty === null) {
    errors.push({
      field: "difficulty",
      reason: "Problem difficulty is invalid.",
    });
  }

  if (!contentLatex) {
    errors.push({
      field: "contentLatex",
      reason: "Problem content is required.",
    });
  }

  if (errors.length > 0 || type === null || difficulty === null) {
    return fail(errors);
  }

  const parsedOptions = parseJsonIfString(input.options);
  const parsedAnswerKey = parseJsonIfString(input.answerKey);

  if (type === "mcq") {
    const validation = validateMcqOptions(
      parsedOptions,
      extractCorrectOptionIds(parsedAnswerKey),
    );

    if (!validation.ok || !validation.value) {
      return fail(validation.errors);
    }

    return ok({
      type,
      difficulty,
      tags,
      contentLatex,
      explanationLatex,
      authoringNotes,
      imagePath,
      options: validation.value.options,
      answerKey: {
        correctOptionIds: validation.value.correctOptionIds,
      },
    });
  }

  if (type === "tf") {
    const optionsValidation = validateOptionCollection(parsedOptions);
    const acceptedValidation = validateTrueFalseAcceptedAnswer(parsedAnswerKey);

    const tfErrors: ProblemBankValidationError[] = [
      ...(!optionsValidation.ok ? optionsValidation.errors : []),
      ...(!acceptedValidation.ok ? acceptedValidation.errors : []),
    ];

    if (tfErrors.length > 0 || !optionsValidation.value || !acceptedValidation.value) {
      return fail(tfErrors);
    }

    return ok({
      type,
      difficulty,
      tags,
      contentLatex,
      explanationLatex,
      authoringNotes,
      imagePath,
      options: optionsValidation.value,
      answerKey: {
        acceptedAnswer: acceptedValidation.value,
      },
    });
  }

  const acceptedValidation = validateCanonicalAcceptedAnswers(parsedAnswerKey);
  if (!acceptedValidation.ok || !acceptedValidation.value) {
    return fail(acceptedValidation.errors);
  }

  return ok({
    type,
    difficulty,
    tags,
    contentLatex,
    explanationLatex,
    authoringNotes,
    imagePath,
    options: null,
    answerKey: {
      acceptedAnswers: acceptedValidation.value,
    },
  });
}

export function toProblemDatabaseColumns(value: ValidatedProblemWriteInput) {
  return {
    type: value.type,
    difficulty: value.difficulty,
    tags: value.tags,
    content_latex: value.contentLatex,
    content: value.contentLatex,
    content_html: value.contentLatex,
    options_json: value.options,
    options: value.options,
    answer_key_json: value.answerKey,
    answers: value.answerKey,
    explanation_latex: value.explanationLatex || null,
    authoring_notes: value.authoringNotes || null,
    image_path: value.imagePath,
    image_url: value.imagePath,
  };
}

export function mapDatabaseError(error: unknown): SafeDatabaseError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? ((error as { code: string }).code ?? "")
      : "";

  switch (code) {
    case "23505":
      return {
        code: "duplicate_resource",
        message: "Resource already exists.",
        status: 409,
      };
    case "23503":
      return {
        code: "invalid_reference",
        message: "Referenced resource is invalid.",
        status: 400,
      };
    case "23514":
      return {
        code: "constraint_failed",
        message: "Request failed validation checks.",
        status: 400,
      };
    case "22P02":
      return {
        code: "invalid_input",
        message: "Request payload is invalid.",
        status: 400,
      };
    case "42501":
      return {
        code: "forbidden",
        message: "You do not have permission for this operation.",
        status: 403,
      };
    default:
      return {
        code: "operation_failed",
        message: "Operation could not be completed.",
        status: 500,
      };
  }
}
