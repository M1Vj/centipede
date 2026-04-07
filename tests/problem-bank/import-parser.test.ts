import Papa from "papaparse";
import { describe, expect, test } from "vitest";
import { parseProblemBankImportCsv } from "@/lib/problem-bank/import-parser";
import { getProblemBankImportTemplateCsv } from "@/lib/problem-bank/import-template";
import { PROBLEM_IMPORT_TEMPLATE_COLUMNS } from "@/lib/problem-bank/types";

function buildCsv(rows: string[][]): string {
  return Papa.unparse({
    fields: [...PROBLEM_IMPORT_TEMPLATE_COLUMNS],
    data: rows,
  });
}

describe("problem-bank import parser", () => {
  test("keeps plain text content and option labels intact", () => {
    const csv = buildCsv([
      [
        "mcq",
        "easy",
        "geometry",
        "A square has four equal sides.",
        JSON.stringify({ correctOptionIds: ["opt_a"] }),
        JSON.stringify([
          { id: "opt_a", label: "Choice A" },
          { id: "opt_b", label: "Choice B" },
        ]),
        "Select the correct statement",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.failedRows).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.contentLatex).toBe("A square has four equal sides.");
    expect(result.rows[0]?.explanationLatex).toBe("Select the correct statement");

    const mcqRow = result.rows[0];
    expect(mcqRow?.type).toBe("mcq");
    if (mcqRow?.type === "mcq") {
      expect(mcqRow.options[0]?.label).toBe("Choice A");
      expect(mcqRow.options[1]?.label).toBe("Choice B");
    }
  });

  test("preserves balanced dollar delimiters from mixed text and math CSV cells", () => {
    const csv = buildCsv([
      [
        "mcq",
        "easy",
        "algebra",
        "Solve for $x$: $7x + 3 = 10$",
        JSON.stringify({ correctOptionIds: ["opt_a"] }),
        JSON.stringify([
          { id: "opt_a", label: "$1$" },
          { id: "opt_b", label: "$2$" },
        ]),
        "Subtract 3 from both sides to get $7x = 7$. Divide by 7 to find $x = 1$.",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.failedRows).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.contentLatex).toBe("Solve for $x$: $7x + 3 = 10$");
    expect(result.rows[0]?.explanationLatex).toBe(
      "Subtract 3 from both sides to get $7x = 7$. Divide by 7 to find $x = 1$.",
    );

    const mcqRow = result.rows[0];
    expect(mcqRow?.type).toBe("mcq");
    if (mcqRow?.type === "mcq") {
      expect(mcqRow.options[0]?.label).toBe("$1$");
      expect(mcqRow.options[1]?.label).toBe("$2$");
    }
  });

  test("preserves spacing when CSV inline math delimiters are adjacent to text", () => {
    const csv = buildCsv([
      [
        "mcq",
        "easy",
        "number-theory",
        "Compute$11 \\pmod{12}$.",
        JSON.stringify({ correctOptionIds: ["opt_a"] }),
        JSON.stringify([
          { id: "opt_a", label: "Between$x$and$y$" },
          { id: "opt_b", label: "Neither" },
        ]),
        "Between$x$and$y$, choose$y$.",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.failedRows).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.contentLatex).toBe("Compute$11 \\pmod{12}$.");
    expect(result.rows[0]?.explanationLatex).toBe("Between$x$and$y$, choose$y$.");

    const mcqRow = result.rows[0];
    expect(mcqRow?.type).toBe("mcq");
    if (mcqRow?.type === "mcq") {
      expect(mcqRow.options[0]?.label).toBe("Between$x$and$y$");
      expect(mcqRow.options[1]?.label).toBe("Neither");
    }
  });

  test("does not rewrite content that already contains explicit LaTeX commands", () => {
    const csv = buildCsv([
      [
        "numeric",
        "average",
        "fractions",
        "$16 \\pmod{12}$",
        "1",
        "",
        "\\text{already has spacing}",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.failedRows).toBe(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.contentLatex).toBe("$16 \\pmod{12}$");
    expect(result.rows[0]?.explanationLatex).toBe("\\text{already has spacing}");
  });

  test("parses valid rows while reporting row-level errors for invalid rows", () => {
    const csv = buildCsv([
      [
        "mcq",
        "easy",
        "Algebra|geometry|algebra",
        "x + 1 = 2",
        JSON.stringify({ correctOptionIds: ["opt_a"] }),
        JSON.stringify([
          { id: "opt_a", label: "Choice A" },
          { id: "opt_b", label: "Choice B" },
        ]),
        "Subtract 1 from both sides",
        "",
        "",
      ],
      [
        "numeric",
        "average",
        "numbers|arithmetic",
        "2 + 2",
        " 4 | 4 | 04 ",
        "",
        "",
        "",
        "",
      ],
      [
        "tf",
        "difficult",
        "logic",
        "A square has four equal sides.",
        "YES",
        JSON.stringify([
          { id: "true", label: "True" },
          { id: "false", label: "False" },
        ]),
        "",
        "",
        "",
      ],
      [
        "mcq",
        "easy",
        "",
        "Invalid row",
        JSON.stringify({ correctOptionIds: ["missing_id"] }),
        JSON.stringify([
          { id: "opt_a", label: "Choice A" },
          { id: "opt_b", label: "Choice B" },
        ]),
        "",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.totalRows).toBe(4);
    expect(result.insertedRowsCandidate).toBe(3);
    expect(result.failedRows).toBe(1);
    expect(result.rows.map((row) => row.type)).toEqual([
      "mcq",
      "numeric",
      "tf",
    ]);

    const mcqRow = result.rows[0];
    expect(mcqRow.type).toBe("mcq");
    expect(mcqRow.tags).toEqual(["Algebra", "geometry"]);

    const numericRow = result.rows[1];
    expect(numericRow.type).toBe("numeric");
    if (numericRow.type === "numeric") {
      expect(numericRow.answerKey.acceptedAnswers).toEqual(["4", "04"]);
    }

    const tfRow = result.rows[2];
    expect(tfRow.type).toBe("tf");
    if (tfRow.type === "tf") {
      expect(tfRow.answerKey.acceptedAnswer).toBe("true");
    }

    expect(result.errors.some((error) => error.rowNumber === 5)).toBe(true);
    expect(
      result.errors.some(
        (error) =>
          error.rowNumber === 5 && error.reason.includes("Correct option id"),
      ),
    ).toBe(true);
  });

  test("supports JSON object and array answer contracts for numeric and identification", () => {
    const csv = buildCsv([
      [
        "identification",
        "easy",
        "vocabulary",
        "Name this shape.",
        JSON.stringify({ acceptedAnswers: [" Alpha ", "alpha", "Beta"] }),
        "",
        "",
        "",
        "",
      ],
      [
        "numeric",
        "average",
        "number-theory",
        "Evaluate 5 + 5",
        JSON.stringify(["10", " 10 ", "20"]),
        "",
        "",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.failedRows).toBe(0);
    expect(result.rows).toHaveLength(2);

    const identificationRow = result.rows[0];
    expect(identificationRow.type).toBe("identification");
    if (identificationRow.type === "identification") {
      expect(identificationRow.answerKey.acceptedAnswers).toEqual([
        "Alpha",
        "Beta",
      ]);
    }

    const numericRow = result.rows[1];
    expect(numericRow.type).toBe("numeric");
    if (numericRow.type === "numeric") {
      expect(numericRow.answerKey.acceptedAnswers).toEqual(["10", "20"]);
    }
  });

  test("does not block valid rows when another row is invalid", () => {
    const csv = buildCsv([
      [
        "essay",
        "easy",
        "",
        "Unsupported type",
        "answer",
        "",
        "",
        "",
        "",
      ],
      [
        "identification",
        "difficult",
        "history",
        "Who discovered penicillin?",
        "Alexander Fleming | alexander fleming",
        "",
        "",
        "",
        "",
      ],
    ]);

    const result = parseProblemBankImportCsv(csv);

    expect(result.totalRows).toBe(2);
    expect(result.insertedRowsCandidate).toBe(1);
    expect(result.failedRows).toBe(1);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.type).toBe("identification");
    expect(result.errors.some((error) => error.rowNumber === 2)).toBe(true);
    expect(
      result.errors.some(
        (error) => error.rowNumber === 2 && error.reason.startsWith("type:"),
      ),
    ).toBe(true);
  });

  test("parses bundled CSV template examples without validation failures", () => {
    const csv = getProblemBankImportTemplateCsv();

    const result = parseProblemBankImportCsv(csv);
    const typeCounts = result.rows.reduce<Record<string, number>>((counts, row) => {
      counts[row.type] = (counts[row.type] ?? 0) + 1;
      return counts;
    }, {});

    expect(result.totalRows).toBe(8);
    expect(result.insertedRowsCandidate).toBe(8);
    expect(result.failedRows).toBe(0);
    expect(result.errors).toEqual([]);
    expect(typeCounts).toEqual({
      mcq: 2,
      tf: 2,
      numeric: 2,
      identification: 2,
    });
  });
});
