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

export function KatexPreview({
  latex,
  label = "Preview",
  displayMode = true,
  className,
  fallbackText = "No preview available.",
}: KatexPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasRenderFailure, setHasRenderFailure] = useState(false);

  const normalizedLatex = useMemo(() => latex.trim(), [latex]);

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
