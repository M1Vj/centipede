import {
  PROBLEM_IMPORT_TEMPLATE_COLUMNS,
  type ProblemImportTemplateColumn,
} from "./types";

export function getProblemBankImportTemplateColumns(): readonly ProblemImportTemplateColumn[] {
  return PROBLEM_IMPORT_TEMPLATE_COLUMNS;
}

export function getProblemBankImportTemplateHeaderRow(): string {
  return PROBLEM_IMPORT_TEMPLATE_COLUMNS.join(",");
}

export function getProblemBankImportTemplateCsv(): string {
  return `${getProblemBankImportTemplateHeaderRow()}\n`;
}
