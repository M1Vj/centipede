import katex from "katex";

export interface LatexSyntaxValidationResult {
  ok: boolean;
  reason: string | null;
}

interface LatexSegment {
  inMath: boolean;
  value: string;
}

const LATEX_CONTROL_SEQUENCE_PATTERN = /\\(?:[A-Za-z]+|[^A-Za-z\s])/;

function isEscaped(value: string, index: number) {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function findClosingDollarDelimiter(value: string, startIndex: number, delimiter: "$" | "$$") {
  for (let index = startIndex; index < value.length; index += 1) {
    if (value.startsWith(delimiter, index) && !isEscaped(value, index)) {
      return index;
    }
  }

  return -1;
}

function findClosingEscapedDelimiter(value: string, startIndex: number, delimiter: "\\)" | "\\]") {
  return value.indexOf(delimiter, startIndex);
}

function splitLatexSegments(value: string): { segments: LatexSegment[]; error: string | null } {
  const segments: LatexSegment[] = [];
  let textBuffer = "";

  for (let index = 0; index < value.length; index += 1) {
    if (value.startsWith("$$", index) && !isEscaped(value, index)) {
      const closingIndex = findClosingDollarDelimiter(value, index + 2, "$$");
      if (closingIndex === -1) {
        return { segments: [], error: "Unclosed $$ math delimiter." };
      }

      if (textBuffer) {
        segments.push({ inMath: false, value: textBuffer });
        textBuffer = "";
      }

      segments.push({ inMath: true, value: value.slice(index + 2, closingIndex) });
      index = closingIndex + 1;
      continue;
    }

    if (value[index] === "$" && !isEscaped(value, index)) {
      const closingIndex = findClosingDollarDelimiter(value, index + 1, "$");
      if (closingIndex === -1) {
        return { segments: [], error: "Unclosed $ math delimiter." };
      }

      if (textBuffer) {
        segments.push({ inMath: false, value: textBuffer });
        textBuffer = "";
      }

      segments.push({ inMath: true, value: value.slice(index + 1, closingIndex) });
      index = closingIndex;
      continue;
    }

    if (value.startsWith("\\(", index)) {
      const closingIndex = findClosingEscapedDelimiter(value, index + 2, "\\)");
      if (closingIndex === -1) {
        return { segments: [], error: "Unclosed \\( math delimiter." };
      }

      if (textBuffer) {
        segments.push({ inMath: false, value: textBuffer });
        textBuffer = "";
      }

      segments.push({ inMath: true, value: value.slice(index + 2, closingIndex) });
      index = closingIndex + 1;
      continue;
    }

    if (value.startsWith("\\[", index)) {
      const closingIndex = findClosingEscapedDelimiter(value, index + 2, "\\]");
      if (closingIndex === -1) {
        return { segments: [], error: "Unclosed \\[ math delimiter." };
      }

      if (textBuffer) {
        segments.push({ inMath: false, value: textBuffer });
        textBuffer = "";
      }

      segments.push({ inMath: true, value: value.slice(index + 2, closingIndex) });
      index = closingIndex + 1;
      continue;
    }

    textBuffer += value[index];
  }

  if (textBuffer) {
    segments.push({ inMath: false, value: textBuffer });
  }

  return { segments, error: null };
}

function hasLatexControlSequence(value: string) {
  return LATEX_CONTROL_SEQUENCE_PATTERN.test(value);
}

function formatKatexError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.replace(/^KaTeX parse error:\s*/, "").trim();
  }

  return "KaTeX could not parse this LaTeX.";
}

function validateKatexExpression(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  try {
    katex.renderToString(normalized, {
      displayMode: false,
      throwOnError: true,
      strict: "ignore",
      trust: false,
    });
    return null;
  } catch (error) {
    return formatKatexError(error);
  }
}

export function validateLatexSyntax(latex: string): LatexSyntaxValidationResult {
  const trimmed = latex.trim();
  if (!trimmed) {
    return {
      ok: true,
      reason: null,
    };
  }

  const { segments, error } = splitLatexSegments(trimmed);
  if (error) {
    return {
      ok: false,
      reason: error,
    };
  }

  const hasMathSegments = segments.some((segment) => segment.inMath);
  const segmentsToValidate = hasMathSegments
    ? segments.filter((segment) => segment.inMath || hasLatexControlSequence(segment.value))
    : [{ inMath: true, value: trimmed }];

  for (const segment of segmentsToValidate) {
    const reason = validateKatexExpression(segment.value);
    if (reason) {
      return {
        ok: false,
        reason,
      };
    }
  }

  return {
    ok: true,
    reason: null,
  };
}
