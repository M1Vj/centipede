"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface KatexPreviewProps {
  latex: string;
  label?: string;
  displayMode?: boolean;
  className?: string;
  fallbackText?: string;
}

interface DollarDelimitedSegment {
  inMath: boolean;
  value: string;
}

const OPENING_PUNCTUATION_PATTERN = /[([{]$/;
const CLOSING_PUNCTUATION_PATTERN = /^[)\]}.,;:!?]/;
const OPERATOR_PATTERN = /^[+\-*/=^_%<>|&]/;
const LEGACY_MATH_ENVIRONMENTS = new Set([
  "aligned",
  "alignedat",
  "align",
  "array",
  "bmatrix",
  "Bmatrix",
  "cases",
  "eqnarray",
  "gather",
  "gathered",
  "matrix",
  "pmatrix",
  "smallmatrix",
  "split",
  "vmatrix",
  "Vmatrix",
]);
const PROSE_WORD_PATTERN = /(?:^|[\s(])[A-Za-z]{3,}(?=[\s).,;:!?]|$)/;
const DELIMITER_FREE_EQUATION_FRAGMENT_PATTERN =
  /\b(?:[^\s=<>.,;:!?]+(?:\s*[+\-*/^_]\s*[^\s=<>.,;:!?]+)*)\s*(?:=|<|>|\\le|\\ge|\\neq|\\approx)\s*(?:[^\s=<>.,;:!?]+(?:\s*[+\-*/^_]\s*[^\s=<>.,;:!?]+)*)/g;
const LATEX_CONTROL_SEQUENCE_PATTERN = /\\(?:[A-Za-z]+|[^A-Za-z\s])/;
const ALIGNMENT_ROW_BREAK_PATTERN = /(?:\\\\|\n)/;

function splitBalancedDollarSegments(value: string): DollarDelimitedSegment[] | null {
  const segments: DollarDelimitedSegment[] = [];
  let buffer = "";
  let inMath = false;
  let sawDelimiter = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = index > 0 ? value[index - 1] : "";

    if (character === "$" && previousCharacter !== "\\") {
      sawDelimiter = true;
      segments.push({
        inMath,
        value: buffer,
      });
      buffer = "";
      inMath = !inMath;
      continue;
    }

    buffer += character;
  }

  if (!sawDelimiter || inMath) {
    return null;
  }

  segments.push({
    inMath,
    value: buffer,
  });

  return segments;
}

function splitBalancedEscapedDollarSegments(value: string): DollarDelimitedSegment[] | null {
  const segments: DollarDelimitedSegment[] = [];
  let buffer = "";
  let inMath = false;
  let sawDelimiter = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextCharacter = index + 1 < value.length ? value[index + 1] : "";
    const previousCharacter = index > 0 ? value[index - 1] : "";

    if (character === "\\" && nextCharacter === "$" && previousCharacter !== "\\") {
      sawDelimiter = true;
      segments.push({
        inMath,
        value: buffer,
      });
      buffer = "";
      inMath = !inMath;
      index += 1;
      continue;
    }

    buffer += character;
  }

  if (!sawDelimiter || inMath) {
    return null;
  }

  segments.push({
    inMath,
    value: buffer,
  });

  return segments;
}

function unwrapTopLevelTextWrapper(value: string): string | null {
  if (!value.startsWith("\\text{")) {
    return null;
  }

  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previousCharacter = index > 0 ? value[index - 1] : "";

    if (character === "{" && previousCharacter !== "\\") {
      depth += 1;
      continue;
    }

    if (character !== "}" || previousCharacter === "\\") {
      continue;
    }

    depth -= 1;

    if (depth !== 0) {
      continue;
    }

    return index === value.length - 1 ? value.slice("\\text{".length, index) : null;
  }

  return null;
}

function extractLegacyEscapedDollarEnvelope(value: string): string | null {
  const inlineWrapped = value.match(/^\$([\s\S]*)\$$/);
  const candidate = inlineWrapped ? inlineWrapped[1].trim() : value;

  return unwrapTopLevelTextWrapper(candidate);
}

function unescapeLegacyMathLiveText(value: string): string {
  return value
    .replace(/\\textbackslash\{\}/g, "\\")
    .replace(/\\\^\{\}/g, "^")
    .replace(/\\~\{\}/g, "~")
    .replace(/\\([{}#$%&_])/g, "$1");
}

function isLikelyEscapedDollarInlineMath(value: string): boolean {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return false;
  }

  if (/^\d+(?:[.,]\d+)?$/.test(trimmedValue)) {
    return false;
  }

  if (hasLatexControlSequence(trimmedValue)) {
    return true;
  }

  if (/[=+\-*/^_{}()<>]/.test(trimmedValue)) {
    return true;
  }

  if (/^[A-Za-z]$/.test(trimmedValue)) {
    return true;
  }

  if (/[A-Za-z]/.test(trimmedValue) && /\d/.test(trimmedValue)) {
    return true;
  }

  return false;
}

function shouldNormalizeEscapedDollarSegments(segments: DollarDelimitedSegment[]): boolean {
  const hasLikelyProse = segments.some(
    (segment) => !segment.inMath && PROSE_WORD_PATTERN.test(segment.value),
  );

  if (!hasLikelyProse) {
    return false;
  }

  return segments.some((segment) => segment.inMath && isLikelyEscapedDollarInlineMath(segment.value));
}

function shouldInsertSpaceBetweenSegments(
  previousSegmentValue: string,
  nextSegmentValue: string,
): boolean {
  if (!previousSegmentValue || !nextSegmentValue) {
    return false;
  }

  const previousCharacter = previousSegmentValue[previousSegmentValue.length - 1] ?? "";
  const nextCharacter = nextSegmentValue[0] ?? "";

  if (!previousCharacter || !nextCharacter) {
    return false;
  }

  if (/\s/.test(previousCharacter) || /\s/.test(nextCharacter)) {
    return false;
  }

  if (OPENING_PUNCTUATION_PATTERN.test(previousCharacter)) {
    return false;
  }

  if (CLOSING_PUNCTUATION_PATTERN.test(nextCharacter)) {
    return false;
  }

  if (OPERATOR_PATTERN.test(previousCharacter) || OPERATOR_PATTERN.test(nextCharacter)) {
    return false;
  }

  return true;
}

function escapeLatexTextSegment(value: string): string {
  return value
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([{}#$%&_])/g, "\\$1")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");
}

function toLatexTextSegment(value: string): string {
  if (!value) {
    return "";
  }

  return `\\text{${escapeLatexTextSegment(value)}}`;
}

function isRecognizedLegacyMathEnvironment(environmentName: string): boolean {
  const normalizedName = environmentName.endsWith("*")
    ? environmentName.slice(0, -1)
    : environmentName;

  return LEGACY_MATH_ENVIRONMENTS.has(normalizedName);
}

function splitLegacyEnvironmentSegments(value: string): DollarDelimitedSegment[] | null {
  if (!value.includes("\\begin{")) {
    return null;
  }

  const pattern = /\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}/g;
  const segments: DollarDelimitedSegment[] = [];
  let cursor = 0;
  let sawRecognizedEnvironment = false;

  for (const match of value.matchAll(pattern)) {
    const block = match[0] ?? "";
    const environmentName = match[1] ?? "";
    const blockIndex = match.index;

    if (!block || blockIndex === undefined || !isRecognizedLegacyMathEnvironment(environmentName)) {
      continue;
    }

    if (blockIndex > cursor) {
      segments.push({
        inMath: false,
        value: value.slice(cursor, blockIndex),
      });
    }

    segments.push({
      inMath: true,
      value: block,
    });

    cursor = blockIndex + block.length;
    sawRecognizedEnvironment = true;
  }

  if (!sawRecognizedEnvironment) {
    return null;
  }

  if (cursor < value.length) {
    segments.push({
      inMath: false,
      value: value.slice(cursor),
    });
  }

  return segments;
}

function isLikelyDelimiterFreeProse(value: string): boolean {
  return /\s/.test(value) && PROSE_WORD_PATTERN.test(value);
}

function isLikelyMathEquationFragment(value: string): boolean {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return false;
  }

  if (/[\\^_{}()]/.test(trimmedValue)) {
    return true;
  }

  if (/\d/.test(trimmedValue)) {
    return true;
  }

  if (/[+\-*/]/.test(trimmedValue)) {
    return true;
  }

  return /^([a-zA-Z])\s*(?:=|<|>|\\le|\\ge|\\neq|\\approx)\s*([a-zA-Z])$/.test(trimmedValue);
}

function splitDelimiterFreeProseEquationSegments(value: string): DollarDelimitedSegment[] | null {
  if (!isLikelyDelimiterFreeProse(value)) {
    return null;
  }

  const segments: DollarDelimitedSegment[] = [];
  let cursor = 0;
  let sawEquationFragment = false;

  for (const match of value.matchAll(DELIMITER_FREE_EQUATION_FRAGMENT_PATTERN)) {
    const fragment = match[0] ?? "";
    const startIndex = match.index;

    if (!fragment || startIndex === undefined || startIndex < cursor) {
      continue;
    }

    if (!isLikelyMathEquationFragment(fragment)) {
      continue;
    }

    if (startIndex > cursor) {
      segments.push({
        inMath: false,
        value: value.slice(cursor, startIndex),
      });
    }

    segments.push({
      inMath: true,
      value: fragment.trim(),
    });

    cursor = startIndex + fragment.length;
    sawEquationFragment = true;
  }

  if (!sawEquationFragment) {
    return [
      {
        inMath: false,
        value,
      },
    ];
  }

  if (cursor < value.length) {
    segments.push({
      inMath: false,
      value: value.slice(cursor),
    });
  }

  return segments;
}

function hasLatexControlSequence(value: string): boolean {
  return LATEX_CONTROL_SEQUENCE_PATTERN.test(value);
}

function shouldWrapAlignedMathFragment(value: string): boolean {
  if (!value.includes("&")) {
    return false;
  }

  if (!ALIGNMENT_ROW_BREAK_PATTERN.test(value)) {
    return false;
  }

  if (value.includes("\\begin{") || value.includes("\\end{")) {
    return false;
  }

  return true;
}

function normalizeMathSegmentForPreview(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (shouldWrapAlignedMathFragment(trimmed)) {
    return `\\begin{aligned}${trimmed}\\end{aligned}`;
  }

  return trimmed;
}

function buildRenderableLatexFromSegments(segments: DollarDelimitedSegment[]): string {
  const convertedSegments = segments.reduce<string[]>((result, segment, index) => {
    if (!segment.value) {
      return result;
    }

    if (index > 0) {
      const previousSegment = segments[index - 1];
      if (shouldInsertSpaceBetweenSegments(previousSegment?.value ?? "", segment.value)) {
        result.push("\\text{ }");
      }
    }

    if (segment.inMath) {
      const normalizedMath = normalizeMathSegmentForPreview(segment.value);
      if (normalizedMath) {
        result.push(normalizedMath);
      }
      return result;
    }

    const textSegment = toLatexTextSegment(segment.value);
    if (textSegment) {
      result.push(textSegment);
    }

    return result;
  }, []);

  return convertedSegments.join("").trim();
}

export function normalizeLatexForPreview(latex: string): string {
  const trimmed = latex.trim();

  const displayWrapped = trimmed.match(/^\$\$([\s\S]*)\$\$$/);
  if (displayWrapped) {
    return displayWrapped[1].trim();
  }

  const legacyEscapedDollarEnvelope = extractLegacyEscapedDollarEnvelope(trimmed);
  if (legacyEscapedDollarEnvelope) {
    const unescapedLegacyText = unescapeLegacyMathLiveText(legacyEscapedDollarEnvelope);
    const legacySegments = splitBalancedDollarSegments(unescapedLegacyText);

    if (legacySegments && shouldNormalizeEscapedDollarSegments(legacySegments)) {
      return buildRenderableLatexFromSegments(legacySegments);
    }
  }

  const escapedDollarSegments = splitBalancedEscapedDollarSegments(trimmed);
  if (escapedDollarSegments && shouldNormalizeEscapedDollarSegments(escapedDollarSegments)) {
    return buildRenderableLatexFromSegments(escapedDollarSegments);
  }

  const inlineWrapped = trimmed.match(/^\$([\s\S]*)\$$/);
  if (inlineWrapped) {
    return inlineWrapped[1].trim();
  }

  const segments = splitBalancedDollarSegments(trimmed);
  if (segments) {
    return buildRenderableLatexFromSegments(segments);
  }

  const legacyEnvironmentSegments = splitLegacyEnvironmentSegments(trimmed);
  if (legacyEnvironmentSegments) {
    const hasLatexOutsideRecognizedEnvironment = legacyEnvironmentSegments.some(
      (segment) => !segment.inMath && hasLatexControlSequence(segment.value),
    );

    if (hasLatexOutsideRecognizedEnvironment) {
      return trimmed;
    }

    return buildRenderableLatexFromSegments(legacyEnvironmentSegments);
  }

  // If content already includes explicit LaTeX commands, render it as-is.
  // This avoids re-escaping valid command sequences from MathLive text-mode output.
  if (hasLatexControlSequence(trimmed)) {
    return normalizeMathSegmentForPreview(trimmed);
  }

  const delimiterFreeProseSegments = splitDelimiterFreeProseEquationSegments(trimmed);
  if (delimiterFreeProseSegments) {
    return buildRenderableLatexFromSegments(delimiterFreeProseSegments);
  }

  return trimmed;
}

export function KatexPreview({
  latex,
  label = "Preview",
  displayMode = true,
  className,
  fallbackText = "No preview available.",
}: KatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasRenderFailure, setHasRenderFailure] = useState(false);

  const normalizedLatex = useMemo(() => normalizeLatexForPreview(latex), [latex]);

  useEffect(() => {
    let active = true;

    const render = async () => {
      if (!containerRef.current) {
        return;
      }

      if (!normalizedLatex) {
        containerRef.current.textContent = "";
        setHasRenderFailure(false);
        return;
      }

      try {
        const katexModule = await import("katex");
        if (!active || !containerRef.current) {
          return;
        }

        katexModule.default.render(normalizedLatex, containerRef.current, {
          displayMode,
          throwOnError: false,
          strict: "ignore",
          trust: false,
        });
        setHasRenderFailure(false);
      } catch {
        if (!active || !containerRef.current) {
          return;
        }

        containerRef.current.textContent = normalizedLatex;
        setHasRenderFailure(true);
      }
    };

    void render();

    return () => {
      active = false;
    };
  }, [displayMode, normalizedLatex]);

  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="min-w-0 rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
        {normalizedLatex ? (
          <div className="min-w-0 overflow-x-auto overflow-y-hidden">
            <div ref={containerRef} className="w-max" />
          </div>
        ) : (
          <p className="text-muted-foreground">{fallbackText}</p>
        )}
      </div>
      {hasRenderFailure ? (
        <p className="text-xs text-muted-foreground">Rendered in plain text fallback mode.</p>
      ) : null}
    </div>
  );
}
