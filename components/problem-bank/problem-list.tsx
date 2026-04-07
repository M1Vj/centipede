"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProblemPreviewCard } from "@/components/problem-bank/problem-preview-card";
import {
  PROBLEM_DIFFICULTIES,
  PROBLEM_TYPES,
  type ProblemDifficulty,
  type ProblemType,
} from "@/lib/problem-bank/types";

export interface ProblemListItem {
  id: string;
  type: ProblemType;
  difficulty: ProblemDifficulty;
  tags: string[];
  contentLatex: string;
  explanationLatex: string;
  updatedAt: string;
}

interface ProblemListProps {
  title?: string;
  problems: ProblemListItem[];
  problemHrefBase?: string;
  editable?: boolean;
}

export function ProblemList({
  title = "Problems",
  problems,
  problemHrefBase,
  editable = false,
}: ProblemListProps) {
  const [typeFilter, setTypeFilter] = useState<ProblemType | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<ProblemDifficulty | "all">("all");
  const [tagFilter, setTagFilter] = useState("");

  const filteredProblems = useMemo(() => {
    const normalizedTagFilter = tagFilter.trim().toLowerCase();

    return problems.filter((problem) => {
      if (typeFilter !== "all" && problem.type !== typeFilter) {
        return false;
      }

      if (difficultyFilter !== "all" && problem.difficulty !== difficultyFilter) {
        return false;
      }

      if (!normalizedTagFilter) {
        return true;
      }

      return problem.tags.some((tag) => tag.toLowerCase().includes(normalizedTagFilter));
    });
  }, [difficultyFilter, problems, tagFilter, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <div className="grid gap-3 rounded-xl border border-border/60 bg-background/80 p-4 md:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="problem-type-filter">Type</Label>
            <select
              id="problem-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as ProblemType | "all")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              {PROBLEM_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="problem-difficulty-filter">Difficulty</Label>
            <select
              id="problem-difficulty-filter"
              value={difficultyFilter}
              onChange={(event) =>
                setDifficultyFilter(event.target.value as ProblemDifficulty | "all")
              }
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              {PROBLEM_DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="problem-tag-filter">Tag text</Label>
            <Input
              id="problem-tag-filter"
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              placeholder="Search tags"
            />
          </div>
        </div>
      </div>

      {filteredProblems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-5 py-8 text-sm text-muted-foreground">
          No problems match the current filters.
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredProblems.map((problem) => {
            const detailHref = problemHrefBase ? `${problemHrefBase}/${problem.id}` : null;

            return (
              <ProblemPreviewCard
                key={problem.id}
                type={problem.type}
                difficulty={problem.difficulty}
                tags={problem.tags}
                contentLatex={problem.contentLatex}
                updatedAt={problem.updatedAt}
                actionHref={detailHref ?? undefined}
                actionLabel={detailHref ? (editable ? "Edit problem" : "View problem") : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
