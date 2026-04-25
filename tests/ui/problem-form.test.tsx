import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { normalizeLatexForPreview } from "@/components/math-editor/katex-preview";
import {
  inferPreferredInitialModeFromValue,
  shouldInsertPastedTextModeContentInMathMode,
  toMathModePasteContent,
} from "@/components/math-editor/mathlive-field";
import { ProblemForm, validateProblemDraft } from "@/components/problem-bank/problem-form";
import { preprocessImageForUpload } from "@/lib/problem-bank/image-preprocessing";

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

vi.mock("@/lib/problem-bank/image-preprocessing", () => ({
  preprocessImageForUpload: vi.fn(),
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

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("ProblemForm validation logic", () => {
  beforeEach(() => {
    capturedMathliveFieldProps.length = 0;
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.mocked(preprocessImageForUpload).mockReset();
    vi.mocked(preprocessImageForUpload).mockImplementation(async (file: File) => file);
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

  test("uses guarded prose detection for math-mode paste normalization", () => {
    expect(shouldInsertPastedTextModeContentInMathMode(" pasted text with spaces ")).toBe(true);
    expect(shouldInsertPastedTextModeContentInMathMode("x + y")).toBe(false);
    expect(shouldInsertPastedTextModeContentInMathMode("x + y = z")).toBe(false);
    expect(shouldInsertPastedTextModeContentInMathMode("\\frac{1}{2} and text")).toBe(false);
    expect(shouldInsertPastedTextModeContentInMathMode("alpha \\: beta")).toBe(false);
    expect(shouldInsertPastedTextModeContentInMathMode("a \\\\ b")).toBe(false);
    expect(shouldInsertPastedTextModeContentInMathMode("singleword")).toBe(false);
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

  test("strips legacy MathLive wrappers when hydrating edit values", () => {
    render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "numeric",
          difficulty: "average",
          tags: ["number-theory"],
          contentLatex: "$ \\text{2+2=?} $",
          explanationLatex: "\\text{Add the two numbers.}",
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: null,
          answerKey: { acceptedAnswers: ["$ \\text{4} $", "\\text{04}"] },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    expect(getCapturedMathliveFieldProps("problem-content")?.value).toBe("2+2=?");
    expect(getCapturedMathliveFieldProps("problem-explanation")?.value).toBe(
      "Add the two numbers.",
    );
    expect(getCapturedMathliveFieldProps("accepted-answer-0")?.value).toBe("4");
    expect(getCapturedMathliveFieldProps("accepted-answer-1")?.value).toBe("04");
  });

  test("preserves canonical imported inline math when hydrating edit values", () => {
    render(
      <ProblemForm
        bankId="bank-1"
        backHref="/organizer/problem-bank/bank-1"
        initialValue={{
          id: "problem-1",
          type: "numeric",
          difficulty: "average",
          tags: ["number-theory"],
          contentLatex: "Solve for $x$: $7x + 3 = 10$",
          explanationLatex: "Use $x = 1$ to verify.",
          authoringNotes: "",
          imagePath: null,
          imageUrl: null,
          options: null,
          answerKey: { acceptedAnswers: ["$1$", "$01$"] },
          updatedAt: "2026-04-07T00:00:00.000Z",
        }}
      />,
    );

    expect(getCapturedMathliveFieldProps("problem-content")?.value).toBe(
      "Solve for $x$: $7x + 3 = 10$",
    );
    expect(getCapturedMathliveFieldProps("problem-explanation")?.value).toBe(
      "Use $x = 1$ to verify.",
    );
    expect(getCapturedMathliveFieldProps("accepted-answer-0")?.value).toBe("$1$");
    expect(getCapturedMathliveFieldProps("accepted-answer-1")?.value).toBe("$01$");
  });

  test("passes preview toggles for all rendered MCQ MathLive fields", () => {
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

  test("does not render a separate mathlete-visible preview card", () => {
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

    expect(screen.queryByText("Mathlete-visible preview")).toBeNull();
    expect(screen.queryByText("Problem Preview")).toBeNull();
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

  test("completes edit save flow in StrictMode and redirects back to the bank", async () => {
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          problem: {
            updatedAt: "2026-04-07T00:00:00.000Z",
          },
        }),
      }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
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
        />
      </StrictMode>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save problem" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    });

    expect(routerPushMock).toHaveBeenCalledTimes(1);
    expect(routerPushMock).toHaveBeenCalledWith("/organizer/problem-bank/bank-1");
    expect(screen.getByRole("button", { name: "Save problem" })).toBeEnabled();
  });

  test("preprocesses image before upload and sends converted file in FormData", async () => {
    const processedFile = new File(["processed"], "diagram.webp", {
      type: "image/webp",
    });
    vi.mocked(preprocessImageForUpload).mockResolvedValue(processedFile);

    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      ({
        ok: true,
        json: async () => ({
          imagePath: "owner/bank/diagram.webp",
          signedUrl: "https://example.com/diagram.webp",
        }),
      }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemForm bankId="bank-1" backHref="/organizer/problem-bank/bank-1" />);

    const fileInput = screen.getByLabelText("Problem image") as HTMLInputElement;
    const sourceFile = new File(["source"], "diagram.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [sourceFile] } });

    await waitFor(() => {
      expect(preprocessImageForUpload).toHaveBeenCalledWith(sourceFile);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(requestInit?.method).toBe("POST");

    const requestBody = requestInit?.body;
    expect(requestBody).toBeInstanceOf(FormData);

    const formData = requestBody as FormData;
    expect(formData.get("bankId")).toBe("bank-1");
    expect(formData.get("file")).toBe(processedFile);
  });

  test("shows explicit conversion error when preprocessing fails and skips upload request", async () => {
    vi.mocked(preprocessImageForUpload).mockRejectedValue(
      new Error("Image conversion failed. Please choose another image."),
    );

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ProblemForm bankId="bank-1" backHref="/organizer/problem-bank/bank-1" />);

    const fileInput = screen.getByLabelText("Problem image") as HTMLInputElement;
    const sourceFile = new File(["source"], "diagram.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [sourceFile] } });

    await waitFor(() => {
      expect(
        screen.getByText("Image conversion failed. Please choose another image."),
      ).toBeInTheDocument();
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("renders soft delete as a confirm dialog and deletes only after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({}),
      }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
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

    await user.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Soft-delete problem?" });
    expect(dialog).toHaveTextContent("This problem will no longer be available in the current bank.");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(await screen.findByRole("button", { name: "Soft delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/organizer/problem-banks/bank-1/problems/problem-1",
        {
          method: "DELETE",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ expectedUpdatedAt: "2026-04-07T00:00:00.000Z" }),
        },
      );
    });

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/organizer/problem-bank/bank-1");
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    });
  });

  test("normalizes sentence-like mixed prose and math for faithful preview", () => {
    const mixedContent = "Find the derivative with respect to x of $f(x) = 8x^{7}$.";

    expect(normalizeLatexForPreview(mixedContent)).toBe(
      "\\text{Find the derivative with respect to x of }f(x) = 8x^{7}\\text{.}",
    );
  });

  test("normalizes escaped-dollar inline math in prose sentences", () => {
    const escapedDollarSentence = "Find the derivative of \\$x^2\\$ at \\$x=3\\$.";
    const wrappedEscapedDollarSentence =
      "$ \\text{Find the derivative with respect to \\$x\\$ of \\$f(x)=2x\\^{}\\{8\\}\\$.} $";

    expect(normalizeLatexForPreview(escapedDollarSentence)).toBe(
      "\\text{Find the derivative of }x^2\\text{ at }x=3\\text{.}",
    );
    expect(normalizeLatexForPreview(wrappedEscapedDollarSentence)).toBe(
      "\\text{Find the derivative with respect to }x\\text{ of }f(x)=2x^{8}\\text{.}",
    );
  });

  test("converts mixed prose and balanced inline dollars while preserving spacing", () => {
    const mixedClipboardText = "Given  $x + 1$  equals\n  $y$.";

    expect(toMathModePasteContent(mixedClipboardText)).toBe(
      "\\text{Given  }x + 1\\text{  equals\n  }y\\text{.}",
    );
  });

  test("keeps native math-mode paste path for clearly math-like balanced dollar input", () => {
    expect(toMathModePasteContent("$x$ + $y$")).toBeNull();
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

  test("preserves explicit MathLive text-mode latex tokens without double escaping", () => {
    const savedContent = "\\text{Find the derivative with respect to }x\\text{ of }f(x)=8x^7\\text{. }";
    const savedExplanation =
      "$ \\text{Apply the power rule: multiply the coefficient by the exponent (}8\\cdot7=56\\text{) and subtract one from the exponent (}7-1=6\\text{). } $";

    expect(normalizeLatexForPreview(savedContent)).toBe(savedContent);
    expect(normalizeLatexForPreview(savedExplanation)).toBe(
      "\\text{Apply the power rule: multiply the coefficient by the exponent (}8\\cdot7=56\\text{) and subtract one from the exponent (}7-1=6\\text{). }",
    );
    expect(normalizeLatexForPreview(savedContent)).not.toContain("\\textbackslash");
  });

  test("preserves math spacing control sequences without escaping", () => {
    const spacedMath = "x\\: + y\\,=\\,z";

    expect(normalizeLatexForPreview(spacedMath)).toBe(spacedMath);
    expect(normalizeLatexForPreview(spacedMath)).not.toContain("\\textbackslash");
  });

  test("wraps table-like aligned math fragments when delimiters are omitted", () => {
    const tableLikeMath = "a & b \\\\ c & d";
    const mixedTableLikeMath = "Compute $a & b \\\\ c & d$.";

    expect(normalizeLatexForPreview(tableLikeMath)).toBe(
      "\\begin{aligned}a & b \\\\ c & d\\end{aligned}",
    );
    expect(normalizeLatexForPreview(mixedTableLikeMath)).toBe(
      "\\text{Compute }\\begin{aligned}a & b \\\\ c & d\\end{aligned}\\text{.}",
    );
  });

  test("preserves complex array wrappers without forcing text escaping", () => {
    const piecewiseFunction =
      "f(x)=\\left\\{\\begin{array}{ll}x^2,&x>0\\\\0,&x\\le0\\end{array}\\right.";

    expect(normalizeLatexForPreview(piecewiseFunction)).toBe(piecewiseFunction);
    expect(normalizeLatexForPreview(piecewiseFunction)).not.toContain("\\textbackslash");
  });

  test("keeps pure math preview input unchanged", () => {
    expect(normalizeLatexForPreview("\\frac{1}{2}"))
      .toBe("\\frac{1}{2}");
  });
});
