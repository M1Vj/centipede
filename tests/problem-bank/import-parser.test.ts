import Papa from "papaparse";
import { describe, expect, test } from "vitest";
import { parseProblemBankImportCsv } from "@/lib/problem-bank/import-parser";
import { PROBLEM_IMPORT_TEMPLATE_COLUMNS } from "@/lib/problem-bank/types";

function buildCsv(rows: string[][]): string {
  return Papa.unparse({
    fields: [...PROBLEM_IMPORT_TEMPLATE_COLUMNS],
    data: rows,
  });
}

describe("problem-bank import parser", () => {
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
});
