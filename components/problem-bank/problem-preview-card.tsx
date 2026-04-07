"use client";

import { KatexPreview } from "@/components/math-editor/katex-preview";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressLink } from "@/components/ui/progress-link";
import type { ProblemDifficulty, ProblemType } from "@/lib/problem-bank/types";

interface ProblemPreviewCardProps {
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tags: string[];
  contentLatex: string;
  updatedAt?: string | null;
  title?: string;
  actionHref?: string;
  actionLabel?: string;
}

export function ProblemPreviewCard({
  type,
  difficulty,
  tags,
  contentLatex,
  updatedAt,
  title = "Problem Preview",
  actionHref,
  actionLabel,
}: ProblemPreviewCardProps) {
  return (
    <Card className="border-border/60 bg-background/90 shadow-sm">
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px] uppercase tracking-widest">
            {type}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase tracking-widest">
            {difficulty}
          </Badge>
          {updatedAt ? (
            <span className="text-xs text-muted-foreground">
              Updated {new Date(updatedAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <KatexPreview latex={contentLatex} label="Prompt" displayMode={false} />
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag, index) => (
              <span
                key={`${type}-${difficulty}-${tag}-${index}`}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        {actionHref && actionLabel ? (
          <ProgressLink
            href={actionHref}
            className="inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            {actionLabel}
          </ProgressLink>
        ) : null}
      </CardContent>
    </Card>
  );
}