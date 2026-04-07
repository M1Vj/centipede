import Papa from "papaparse";
import {
  normalizeProblemDifficulty,
  normalizeProblemType,
  parsePipeDelimitedTags,
} from "./normalization";
import {
  validateCanonicalAcceptedAnswers,
  validateMcqOptions,
  validateOptionCollection,
  validateTrueFalseAcceptedAnswer,
} from "./validation";
import {
  PROBLEM_IMPORT_TEMPLATE_COLUMNS,
  type ProblemImportParseError,
  type ProblemImportParseSummary,
  type ProblemImportRow,
  type ProblemImportRowBase,
  type ProblemImportTemplateColumn,
} from "./types";

type RawImportRow = Partial<Record<ProblemImportTemplateColumn, string>> &
  Record<string, string | undefined>;

interface JsonParseAttempt {
  parsed: boolean;
  value: unknown;
}

interface RowParseOutcome {
  row: ProblemImportRow | null;
  errors: ProblemImportParseError[];
}

function normalizeImportedLatexText(value: string): string {
  return value.trim();
}

function normalizeImportedOptionLabel(value: string): string {
  return normalizeImportedLatexText(value);
}

function readCell(row: RawImportRow, column: ProblemImportTemplateColumn): string {
  const value = row[column];
  return typeof value === "string" ? value : "";
}

function tryParseJsonValue(rawValue: string): JsonParseAttempt {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return {
      parsed: false,
      value: "",
    };
  }

  try {
    return {
      parsed: true,
      value: JSON.parse(trimmed),
    };
  } catch {
    return {
      parsed: false,
      value: trimmed,
    };
  }
}

function toRowErrors(
  rowNumber: number,
  errors: { field: string; reason: string }[],
): ProblemImportParseError[] {
  return errors.map((error) => ({
    rowNumber,
    reason: `${error.field}: ${error.reason}`,
  }));
}

function extractMcqCorrectOptionIds(source: unknown): unknown {
  if (Array.isArray(source)) {
    return source;
  }

  if (typeof source !== "object" || source === null) {
    return source;
  }

  const record = source as Record<string, unknown>;
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

function collectHeaderErrors(fields: string[] | undefined): ProblemImportParseError[] {
  if (!fields || fields.length === 0) {
    return [
      {
        rowNumber: 1,
        reason: "CSV header row is required.",
      },
    ];
  }

  const missingHeaders = PROBLEM_IMPORT_TEMPLATE_COLUMNS.filter(
    (column) => !fields.includes(column),
  );

  if (missingHeaders.length === 0) {
    return [];
  }

  return [
    {
      rowNumber: 1,
      reason: `Missing required header columns: ${missingHeaders.join(", ")}.`,
    },
  ];
}

function parseRow(rawRow: RawImportRow, rowNumber: number): RowParseOutcome {
  const errors: ProblemImportParseError[] = [];

  const typeValue = normalizeProblemType(readCell(rawRow, "type"));
  if (typeValue === null) {
    errors.push({
      rowNumber,
      reason: "type: Invalid value. Allowed values are mcq, tf, numeric, identification.",
    });
  }

  const difficultyValue = normalizeProblemDifficulty(readCell(rawRow, "difficulty"));
  if (difficultyValue === null) {
    errors.push({
      rowNumber,
      reason: "difficulty: Invalid value. Allowed values are easy, average, difficult.",
    });
  }

  if (errors.length > 0 || typeValue === null || difficultyValue === null) {
    return {
      row: null,
      errors,
    };
  }

  const rowBase: ProblemImportRowBase = {
    rowNumber,
    type: typeValue,
    difficulty: difficultyValue,
    tags: parsePipeDelimitedTags(readCell(rawRow, "tags")),
    contentLatex: normalizeImportedLatexText(readCell(rawRow, "content_latex")),
    explanationLatex: normalizeImportedLatexText(readCell(rawRow, "explanation_latex")),
    authoringNotes: readCell(rawRow, "authoring_notes").trim(),
    imagePath: readCell(rawRow, "image_path").trim() || null,
  };

  const rawAnswerKey = readCell(rawRow, "answer_key_json");
  const rawOptions = readCell(rawRow, "options_json");

  if (typeValue === "mcq") {
    if (!rawOptions.trim()) {
      errors.push({
        rowNumber,
        reason: "options_json: options_json is required for mcq rows.",
      });
    }

    if (!rawAnswerKey.trim()) {
      errors.push({
        rowNumber,
        reason: "answer_key_json: answer_key_json is required for mcq rows.",
      });
    }

    const optionsAttempt = tryParseJsonValue(rawOptions);
    if (rawOptions.trim() && !optionsAttempt.parsed) {
      errors.push({
        rowNumber,
        reason: "options_json: options_json must be valid JSON for mcq rows.",
      });
    }

    if (errors.length > 0) {
      return { row: null, errors };
    }

    const answerAttempt = tryParseJsonValue(rawAnswerKey);
    const answerSource = answerAttempt.parsed ? answerAttempt.value : rawAnswerKey;

    const mcqValidation = validateMcqOptions(
      optionsAttempt.value,
      extractMcqCorrectOptionIds(answerSource),
    );

    if (!mcqValidation.ok || mcqValidation.value === null) {
      return {
        row: null,
        errors: toRowErrors(rowNumber, mcqValidation.errors),
      };
    }

    return {
      row: {
        ...rowBase,
        type: "mcq",
        answerKey: {
          correctOptionIds: mcqValidation.value.correctOptionIds,
        },
        options: mcqValidation.value.options.map((option) => ({
          ...option,
          label: normalizeImportedOptionLabel(option.label),
        })),
      },
      errors: [],
    };
  }

  if (typeValue === "tf") {
    if (!rawOptions.trim()) {
      errors.push({
        rowNumber,
        reason: "options_json: options_json is required for tf rows.",
      });
    }

    if (!rawAnswerKey.trim()) {
      errors.push({
        rowNumber,
        reason: "answer_key_json: answer_key_json is required for tf rows.",
      });
    }

    const optionsAttempt = tryParseJsonValue(rawOptions);
    if (rawOptions.trim() && !optionsAttempt.parsed) {
      errors.push({
        rowNumber,
        reason: "options_json: options_json must be valid JSON for tf rows.",
      });
    }

    if (errors.length > 0) {
      return { row: null, errors };
    }

    const optionValidation = validateOptionCollection(optionsAttempt.value);
    if (!optionValidation.ok || optionValidation.value === null) {
      return {
        row: null,
        errors: toRowErrors(rowNumber, optionValidation.errors),
      };
    }

    const answerAttempt = tryParseJsonValue(rawAnswerKey);
    const answerSource = answerAttempt.parsed ? answerAttempt.value : rawAnswerKey;
    const trueFalseValidation = validateTrueFalseAcceptedAnswer(answerSource);
    if (!trueFalseValidation.ok || trueFalseValidation.value === null) {
      return {
        row: null,
        errors: toRowErrors(rowNumber, trueFalseValidation.errors),
      };
    }

    return {
      row: {
        ...rowBase,
        type: "tf",
        answerKey: {
          acceptedAnswer: trueFalseValidation.value,
        },
        options: optionValidation.value.map((option) => ({
          ...option,
          label: normalizeImportedOptionLabel(option.label),
        })),
      },
      errors: [],
    };
  }

  if (!rawAnswerKey.trim()) {
    return {
      row: null,
      errors: [
        {
          rowNumber,
          reason: "answer_key_json: answer_key_json is required for numeric and identification rows.",
        },
      ],
    };
  }

  const answerAttempt = tryParseJsonValue(rawAnswerKey);
  const answerSource = answerAttempt.parsed ? answerAttempt.value : rawAnswerKey;
  const acceptedAnswerValidation = validateCanonicalAcceptedAnswers(answerSource);

  if (!acceptedAnswerValidation.ok || acceptedAnswerValidation.value === null) {
    return {
      row: null,
      errors: toRowErrors(rowNumber, acceptedAnswerValidation.errors),
    };
  }

  if (typeValue === "numeric") {
    return {
      row: {
        ...rowBase,
        type: "numeric",
        answerKey: {
          acceptedAnswers: acceptedAnswerValidation.value,
        },
        options: null,
      },
      errors: [],
    };
  }

  return {
    row: {
      ...rowBase,
      type: "identification",
      answerKey: {
        acceptedAnswers: acceptedAnswerValidation.value,
      },
      options: null,
    },
    errors: [],
  };
}

export function parseProblemBankImportCsv(csvText: string): ProblemImportParseSummary {
  const parseResult = Papa.parse<RawImportRow>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const rows: ProblemImportRow[] = [];
  const errors: ProblemImportParseError[] = [];

  errors.push(...collectHeaderErrors(parseResult.meta.fields));

  for (const parseError of parseResult.errors) {
    const rowNumber =
      typeof parseError.row === "number" ? parseError.row + 2 : 1;

    errors.push({
      rowNumber,
      reason: `CSV parse error: ${parseError.message}`,
    });
  }

  parseResult.data.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const outcome = parseRow(rawRow, rowNumber);
    if (outcome.row !== null) {
      rows.push(outcome.row);
      return;
    }

    errors.push(...outcome.errors);
  });

  const totalRows = parseResult.data.length;
  const insertedRowsCandidate = rows.length;
  const failedRows = totalRows - insertedRowsCandidate;

  return {
    totalRows,
    insertedRowsCandidate,
    failedRows,
    errors,
    rows,
  };
}
