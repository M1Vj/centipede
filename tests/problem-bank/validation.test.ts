import { describe, expect, test } from "vitest";
import {
  validateBankInput,
  validateCanonicalAcceptedAnswers,
  validateMcqOptions,
  validateTrueFalseAcceptedAnswer,
} from "@/lib/problem-bank/validation";

describe("problem-bank validation", () => {
  test("requires bank name", () => {
    const result = validateBankInput({
      name: "   ",
      description: "sample",
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.field === "name")).toBe(true);
  });

  test("limits bank description to 200 words", () => {
    const tooLongDescription = new Array(201).fill("word").join(" ");
    const result = validateBankInput({
      name: "Geometry Bank",
      description: tooLongDescription,
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.field === "description")).toBe(
      true,
    );
  });

  test("accepts valid bank input after normalization", () => {
    const result = validateBankInput({
      name: "  Algebra Bank ",
      description: "  Focused reviewer set.  ",
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      name: "Algebra Bank",
      description: "Focused reviewer set.",
    });
  });

  test("mcq options must include at least 2 entries", () => {
    const result = validateMcqOptions(
      [{ id: "opt_a", label: "A" }],
      ["opt_a"],
    );

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.reason.includes("At least 2 options are required."),
      ),
    ).toBe(true);
  });

  test("mcq labels must be unique after trim/lowercase", () => {
    const result = validateMcqOptions(
      [
        { id: "opt_a", label: " Choice " },
        { id: "opt_b", label: "choice" },
      ],
      ["opt_a"],
    );

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.reason.includes("Option labels must be unique"),
      ),
    ).toBe(true);
  });

  test("mcq ids must be unique after trim/lowercase", () => {
    const result = validateMcqOptions(
      [
        { id: " A ", label: "Choice A" },
        { id: "a", label: "Choice B" },
      ],
      ["a"],
    );

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.reason.includes("Option ids must be unique"),
      ),
    ).toBe(true);
  });

  test("mcq correct option ids must exist in option ids", () => {
    const result = validateMcqOptions(
      [
        { id: "opt_a", label: "Choice A" },
        { id: "opt_b", label: "Choice B" },
      ],
      ["missing"],
    );

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.reason.includes("does not exist in options_json"),
      ),
    ).toBe(true);
  });

  test("mcq validation normalizes correct ids to canonical option ids", () => {
    const result = validateMcqOptions(
      [
        { id: "opt_a", label: "Choice A" },
        { id: "opt_b", label: "Choice B" },
      ],
      [" OPT_A ", "opt_b", "opt_a"],
    );

    expect(result.ok).toBe(true);
    expect(result.value?.correctOptionIds).toEqual(["opt_a", "opt_b"]);
  });

  test("tf accepted answer normalizes supported variants", () => {
    expect(validateTrueFalseAcceptedAnswer(" YES ").value).toBe("true");
    expect(validateTrueFalseAcceptedAnswer({ acceptedAnswer: "0" }).value).toBe(
      "false",
    );
  });

  test("tf accepted answer must be exactly one value", () => {
    const result = validateTrueFalseAcceptedAnswer(["true", "false"]);
    expect(result.ok).toBe(false);
  });

  test("tf accepted answer rejects invalid values", () => {
    const result = validateTrueFalseAcceptedAnswer("maybe");
    expect(result.ok).toBe(false);
  });

  test("canonical accepted answers support object and pipe-delimited formats", () => {
    const fromObject = validateCanonicalAcceptedAnswers({
      acceptedAnswers: ["  Alpha ", "alpha", "Beta"],
    });
    expect(fromObject.ok).toBe(true);
    expect(fromObject.value).toEqual(["Alpha", "Beta"]);

    const fromPipeDelimited = validateCanonicalAcceptedAnswers(" one | One | two ");
    expect(fromPipeDelimited.ok).toBe(true);
    expect(fromPipeDelimited.value).toEqual(["one", "two"]);
  });
});
