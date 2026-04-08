import {
  PROBLEM_IMPORT_TEMPLATE_COLUMNS,
  type ProblemImportTemplateColumn,
} from "./types";

type TemplateExampleRow = Record<ProblemImportTemplateColumn, string>;

const TEMPLATE_EXAMPLE_ROWS: readonly TemplateExampleRow[] = [
  {
    type: "mcq",
    difficulty: "easy",
    tags: "algebra|linear",
    content_latex: "x + 1 = 2",
    answer_key_json: JSON.stringify({ correctOptionIds: ["opt_a"] }),
    options_json: JSON.stringify([
      { id: "opt_a", label: "x = 1" },
      { id: "opt_b", label: "x = -1" },
    ]),
    explanation_latex: "Subtract 1 from both sides",
    authoring_notes: "Sample MCQ row 1",
    image_path: "",
  },
  {
    type: "mcq",
    difficulty: "average",
    tags: "geometry|angles",
    content_latex: "A right angle measures?",
    answer_key_json: JSON.stringify({ correctOptionIds: ["opt_c"] }),
    options_json: JSON.stringify([
      { id: "opt_a", label: "45" },
      { id: "opt_b", label: "60" },
      { id: "opt_c", label: "90" },
    ]),
    explanation_latex: "Right angles are 90 degrees",
    authoring_notes: "Sample MCQ row 2",
    image_path: "",
  },
  {
    type: "tf",
    difficulty: "easy",
    tags: "logic",
    content_latex: "A square has four equal sides.",
    answer_key_json: "true",
    options_json: JSON.stringify([
      { id: "true", label: "True" },
      { id: "false", label: "False" },
    ]),
    explanation_latex: "Definition of square",
    authoring_notes: "Sample TF row 1",
    image_path: "",
  },
  {
    type: "tf",
    difficulty: "difficult",
    tags: "number-theory",
    content_latex: "Every prime number is odd.",
    answer_key_json: "false",
    options_json: JSON.stringify([
      { id: "true", label: "True" },
      { id: "false", label: "False" },
    ]),
    explanation_latex: "2 is prime and even",
    authoring_notes: "Sample TF row 2",
    image_path: "",
  },
  {
    type: "numeric",
    difficulty: "easy",
    tags: "arithmetic",
    content_latex: "2 + 2",
    answer_key_json: "4|04",
    options_json: "",
    explanation_latex: "Basic addition",
    authoring_notes: "Sample numeric row 1",
    image_path: "",
  },
  {
    type: "numeric",
    difficulty: "average",
    tags: "fractions",
    content_latex: "\\frac{1}{2} + \\frac{1}{2}",
    answer_key_json: JSON.stringify({ acceptedAnswers: ["1", "1.0"] }),
    options_json: "",
    explanation_latex: "Equivalent decimal accepted",
    authoring_notes: "Sample numeric row 2",
    image_path: "",
  },
  {
    type: "identification",
    difficulty: "easy",
    tags: "geometry",
    content_latex: "Name the polygon with 3 sides.",
    answer_key_json: "triangle|Triangle",
    options_json: "",
    explanation_latex: "3-sided polygon",
    authoring_notes: "Sample identification row 1",
    image_path: "",
  },
  {
    type: "identification",
    difficulty: "difficult",
    tags: "algebra",
    content_latex: "Name the formula x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}.",
    answer_key_json: JSON.stringify({ acceptedAnswers: ["Quadratic Formula"] }),
    options_json: "",
    explanation_latex: "Canonical naming example",
    authoring_notes: "Sample identification row 2",
    image_path: "",
  },
];

function toCsvCell(value: string): string {
  if (!/[",\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function toCsvRow(row: TemplateExampleRow): string {
  return PROBLEM_IMPORT_TEMPLATE_COLUMNS.map((column) => toCsvCell(row[column])).join(",");
}

export function getProblemBankImportTemplateColumns(): readonly ProblemImportTemplateColumn[] {
  return PROBLEM_IMPORT_TEMPLATE_COLUMNS;
}

export function getProblemBankImportTemplateHeaderRow(): string {
  return PROBLEM_IMPORT_TEMPLATE_COLUMNS.join(",");
}

export function getProblemBankImportTemplateCsv(): string {
  const rows = TEMPLATE_EXAMPLE_ROWS.map(toCsvRow).join("\n");
  return `${getProblemBankImportTemplateHeaderRow()}\n${rows}\n`;
}
