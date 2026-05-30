import { describe, expect, test } from "vitest";
import { validateLatexSyntax } from "@/lib/math/latex-validation";

describe("validateLatexSyntax", () => {
  test("accepts prose, raw math, and mixed inline math", () => {
    expect(validateLatexSyntax("Find the value of x.").ok).toBe(true);
    expect(validateLatexSyntax("\\frac{1}{2} + x").ok).toBe(true);
    expect(validateLatexSyntax("Solve $x + 1 = 2$ before time expires.").ok).toBe(true);
    expect(validateLatexSyntax("Use \\(x^2\\) and \\[y^2\\].").ok).toBe(true);
  });

  test("rejects malformed KaTeX input", () => {
    expect(validateLatexSyntax("\\frac{1}{").ok).toBe(false);
    expect(validateLatexSyntax("\\notacommand{1}").ok).toBe(false);
    expect(validateLatexSyntax("Solve $x + 1").ok).toBe(false);
  });
});
