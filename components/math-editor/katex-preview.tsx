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
      const normalizedMath = segment.value.trim();
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
    return buildRenderableLatexFromSegments(legacyEnvironmentSegments);
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
    <div className={cn("grid gap-2", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
        {normalizedLatex ? (
          <div ref={containerRef} className="overflow-x-auto" />
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
