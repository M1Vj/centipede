export const PROBLEM_TYPES = ["mcq", "tf", "numeric", "identification"] as const;

export type ProblemType = (typeof PROBLEM_TYPES)[number];

export const PROBLEM_DIFFICULTIES = ["easy", "average", "difficult"] as const;

export type ProblemDifficulty = (typeof PROBLEM_DIFFICULTIES)[number];

export type TrueFalseCanonical = "true" | "false";

export interface ProblemOption {
  id: string;
  label: string;
}

export interface McqAnswerKey {
  correctOptionIds: string[];
}

export interface TrueFalseAnswerKey {
  acceptedAnswer: TrueFalseCanonical;
}

export interface MultiValueAnswerKey {
  acceptedAnswers: string[];
}

export interface ProblemBankValidationError {
  field: string;
  reason: string;
}

export interface ValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: ProblemBankValidationError[];
}

export interface ValidatedBankInput {
  name: string;
  description: string;
}

export const PROBLEM_IMPORT_TEMPLATE_COLUMNS = [
  "type",
  "difficulty",
  "tags",
  "content_latex",
  "answer_key_json",
  "options_json",
  "explanation_latex",
  "authoring_notes",
  "image_path",
] as const;

export type ProblemImportTemplateColumn =
  (typeof PROBLEM_IMPORT_TEMPLATE_COLUMNS)[number];

export interface ProblemImportParseError {
  rowNumber: number;
  reason: string;
}

export interface ProblemImportRowBase {
  rowNumber: number;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tags: string[];
  contentLatex: string;
  explanationLatex: string;
  authoringNotes: string;
  imagePath: string | null;
}

export interface ProblemImportMcqRow extends ProblemImportRowBase {
  type: "mcq";
  answerKey: McqAnswerKey;
  options: ProblemOption[];
}

export interface ProblemImportTrueFalseRow extends ProblemImportRowBase {
  type: "tf";
  answerKey: TrueFalseAnswerKey;
  options: ProblemOption[];
}

export interface ProblemImportNumericRow extends ProblemImportRowBase {
  type: "numeric";
  answerKey: MultiValueAnswerKey;
  options: null;
}

export interface ProblemImportIdentificationRow extends ProblemImportRowBase {
  type: "identification";
  answerKey: MultiValueAnswerKey;
  options: null;
}

export type ProblemImportRow =
  | ProblemImportMcqRow
  | ProblemImportTrueFalseRow
  | ProblemImportNumericRow
  | ProblemImportIdentificationRow;

export interface ProblemImportParseSummary {
  totalRows: number;
  insertedRowsCandidate: number;
  failedRows: number;
  errors: ProblemImportParseError[];
  rows: ProblemImportRow[];
}
