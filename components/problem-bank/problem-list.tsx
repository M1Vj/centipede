"use client";

import { useMemo, useState } from "react";

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-black text-[#10182b]">{title}</h2>
        <span className="text-[13px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full self-start sm:self-auto">
          {filteredProblems.length} problems
        </span>
      </div>

      {/* Filter Bar */}
      <div className="grid gap-4 sm:grid-cols-3 bg-slate-50 rounded-2xl border border-slate-100 p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="problem-type-filter" className="text-[#10182b] font-bold text-[12px] uppercase tracking-wider">
            Type
          </label>
          <select
            id="problem-type-filter"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as ProblemType | "all")}
            className="bg-white border border-slate-200 text-[#10182b] rounded-xl px-4 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all"
          >
            <option value="all">All Types</option>
            {PROBLEM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="problem-difficulty-filter" className="text-[#10182b] font-bold text-[12px] uppercase tracking-wider">
            Difficulty
          </label>
          <select
            id="problem-difficulty-filter"
            value={difficultyFilter}
            onChange={(event) => setDifficultyFilter(event.target.value as ProblemDifficulty | "all")}
            className="bg-white border border-slate-200 text-[#10182b] rounded-xl px-4 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all"
          >
            <option value="all">All Difficulties</option>
            {PROBLEM_DIFFICULTIES.map((difficulty) => (
              <option key={difficulty} value={difficulty}>{difficulty}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="problem-tag-filter" className="text-[#10182b] font-bold text-[12px] uppercase tracking-wider">
            Tag Search
          </label>
          <input
            id="problem-tag-filter"
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="Search by tag..."
            className="bg-white border border-slate-200 text-[#10182b] rounded-xl px-4 py-2.5 text-[14px] font-medium focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {filteredProblems.length === 0 ? (
        <div className="bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center text-slate-500 font-medium">
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

