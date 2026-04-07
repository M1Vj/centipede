import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { normalizeLatexForPreview } from "@/components/math-editor/katex-preview";
import { inferPreferredInitialModeFromValue } from "@/components/math-editor/mathlive-field";
import { ProblemForm, validateProblemDraft } from "@/components/problem-bank/problem-form";

const capturedMathliveFieldProps: Array<Record<string, unknown>> = [];
const routerPushMock = vi.fn();
const routerRefreshMock = vi.fn();

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock,
  }),
}));

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/math-editor/mathlive-field", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/math-editor/mathlive-field")>();

  return {
    ...actual,
    MathliveField: (props: Record<string, unknown>) => {
      capturedMathliveFieldProps.push(props);
      return <div data-testid={`mathlive-${String(props.id ?? "field")}`} />;
    },
  };
});

function getCapturedMathliveFieldProps(fieldId: string): Record<string, unknown> | undefined {
  return capturedMathliveFieldProps.find((props) => props.id === fieldId);
}

describe("ProblemForm validation logic", () => {
  beforeEach(() => {
    capturedMathliveFieldProps.length = 0;
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("rejects mcq options with duplicate labels before submit", () => {
    const result = validateProblemDraft({
      type: "mcq",
      difficulty: "easy",
      tags: "algebra",
      contentLatex: "x + 1 = 2",
      explanationLatex: "Subtract 1",
      authoringNotes: "",
      imagePath: null,
      options: [
        { id: "opt_a", label: " Choice " },
        { id: "opt_b", label: "choice" },
      ],
      answerKey: { correctOptionIds: ["opt_a"] },
    });

    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.reason.includes("Option labels must be unique"),
      ),
    ).toBe(true);
  });

  test("normalizes canonical accepted answers for numeric problems", () => {
    const result = validateProblemDraft({
      type: "numeric",
      difficulty: "average",
      tags: "numbers",
      contentLatex: "2+2",
      explanationLatex: "",
      authoringNotes: "",
      imagePath: null,
      options: null,
      answerKey: " 4 | 4 | 04 ",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.answerKey).toEqual({
      acceptedAnswers: ["4", "04"],
    });
  });

  test("prefers text mode inference for prose and mixed prose/math content", () => {
    expect(inferPreferredInitialModeFromValue("Solve for x: 7x + 3 = 10")).toBe("text");
    expect(inferPreferredInitialModeFromValue("Between x and y, choose y.")).toBe("text");
    expect(inferPreferredInitialModeFromValue("Compute 11\\pmod{12}. Show the remainder.")).toBe("text");
    expect(inferPreferredInitialModeFromValue("\\frac{1}{2}")).toBe("math");
  });

  test("passes text defaults and preserves imported prompt/explanation values", () => {
    const importedContent = "Compute 11 \\pmod{12}.";
    const importedExplanation = "Show each step clearly.";

    render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "numeric",
          difficulty: "average",
          tags: ["number-theory"],
          contentLatex: importedContent,
          explanationLatex: importedExplanation,
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: null,
          answerKey: { acceptedAnswers: ["x + 1", "x + 2"] },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    expect(getCapturedMathliveFieldProps("problem-content")?.preferredInitialMode).toBe("text");
    expect(getCapturedMathliveFieldProps("problem-explanation")?.preferredInitialMode).toBe("text");
    expect(getCapturedMathliveFieldProps("accepted-answer-0")?.preferredInitialMode).toBe("math");
    expect(getCapturedMathliveFieldProps("problem-content")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("problem-explanation")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("accepted-answer-0")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("accepted-answer-1")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("problem-content")?.value).toBe(importedContent);
    expect(getCapturedMathliveFieldProps("problem-explanation")?.value).toBe(importedExplanation);
  });

  test("passes preview toggles for all rendered MCQ MathLive fields", () => {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "mcq",
          difficulty: "average",
          tags: ["number-theory"],
          contentLatex: "Choose the correct value.",
          explanationLatex: "Pick one option.",
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: [
            { id: "opt_a", label: "x + 1" },
            { id: "opt_b", label: "x + 2" },
          ],
          answerKey: { correctOptionIds: ["opt_a"] },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    expect(getCapturedMathliveFieldProps("problem-content")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("problem-explanation")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("mcq-option-label-opt_a")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("mcq-option-label-opt_b")?.showPreviewToggle).toBe(true);
  });

  test("passes preview toggles for all rendered TF MathLive fields", () => {
    render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "tf",
          difficulty: "average",
          tags: ["logic"],
          contentLatex: "This statement is true or false.",
          explanationLatex: "Choose true or false.",
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: [
            { id: "true", label: "True" },
            { id: "false", label: "False" },
          ],
          answerKey: { acceptedAnswer: "true" },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    expect(getCapturedMathliveFieldProps("problem-content")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("problem-explanation")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("tf-option-label-true")?.showPreviewToggle).toBe(true);
    expect(getCapturedMathliveFieldProps("tf-option-label-false")?.showPreviewToggle).toBe(true);
  });

  test("renders a single mathlete-visible preview section in the form", () => {
    render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "numeric",
          difficulty: "average",
          tags: ["number-theory"],
          contentLatex: "Compute 11 \\pmod{12}.",
          explanationLatex: "Show each step clearly.",
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: null,
          answerKey: { acceptedAnswers: ["x + 1"] },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Mathlete-visible preview")).toBeInTheDocument();
    expect(screen.queryByText("Accepted answer preview")).toBeNull();
  });

  test("ignores late save completion after unmount to avoid exit-flow runtime errors", async () => {
    const deferredResponse = createDeferred<Response>();
    const fetchMock = vi.fn(() => deferredResponse.promise);
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "numeric",
          difficulty: "average",
          tags: ["number-theory"],
          contentLatex: "2+2",
          explanationLatex: "",
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: null,
          answerKey: { acceptedAnswers: ["4"] },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save problem" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();

    deferredResponse.resolve({
      ok: true,
      json: async () => ({
        problem: {
          updatedAt: "2026-04-07T00:00:00.000Z",
        },
      }),
    } as Response);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(routerPushMock).not.toHaveBeenCalled();
    expect(routerRefreshMock).not.toHaveBeenCalled();
  });

  test("normalizes sentence-like mixed prose and math for faithful preview", () => {
    const mixedContent = "Find the derivative with respect to x of $f(x) = 8x^{7}$.";

    expect(normalizeLatexForPreview(mixedContent)).toBe(
      "\\text{Find the derivative with respect to x of }f(x) = 8x^{7}\\text{.}",
    );
  });

  test("normalizes delimiter-free legacy prose rows while preserving spacing", () => {
    const legacyNoDelimiterContent = "Find the derivative with respect to x of f(x) = 8x^{7}.";

    expect(normalizeLatexForPreview(legacyNoDelimiterContent)).toBe(
      "\\text{Find the derivative with respect to x of }f(x) = 8x^{7}\\text{.}",
    );
  });

  test("normalizes matrix sentences while preserving readable prose spacing", () => {
    const mixedMatrix =
      "Calculate the determinant of the matrix \\begin{bmatrix} -3 & 0 \\\\ 1 & 3 \\end{bmatrix}.";

    expect(normalizeLatexForPreview(mixedMatrix)).toBe(
      "\\text{Calculate the determinant of the matrix }\\begin{bmatrix} -3 & 0 \\\\ 1 & 3 \\end{bmatrix}\\text{.}",
    );
  });

  test("keeps pure math preview input unchanged", () => {
    expect(normalizeLatexForPreview("\\frac{1}{2}"))
      .toBe("\\frac{1}{2}");
  });
});
