"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDownUp, ChevronLeft, ChevronRight, Eye, Filter, Pencil, Trash2 } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
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
  inUse?: string | null;
}

interface ProblemListProps {
  title?: string;
  problems: ProblemListItem[];
  problemHrefBase?: string;
  editable?: boolean;
}

const PAGE_SIZE = 10;

const TYPE_LABELS: Record<ProblemType, string> = {
  mcq: "MCQ",
  tf: "T/F",
  numeric: "Numeric",
  identification: "ID",
};

const DIFFICULTY_COLORS: Record<ProblemDifficulty, string> = {
  easy: "text-slate-500",
  average: "text-[#f49700]",
  difficult: "text-[#10182b]",
};

const DIFFICULTY_LABELS: Record<ProblemDifficulty, string> = {
  easy: "Easy",
  average: "Average",
  difficult: "Difficult",
};

export function ProblemList({
  problems,
  problemHrefBase,
  editable = false,
}: ProblemListProps) {
  const [typeFilter, setTypeFilter] = useState<ProblemType | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<ProblemDifficulty | "all">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredProblems = useMemo(() => {
    let result = problems.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (difficultyFilter !== "all" && p.difficulty !== difficultyFilter) return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      const da = new Date(a.updatedAt).getTime();
      const db = new Date(b.updatedAt).getTime();
      return sortOrder === "newest" ? db - da : da - db;
    });

    return result;
  }, [problems, typeFilter, difficultyFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pagedProblems = filteredProblems.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSelectAll = () => {
    if (selectedIds.length === pagedProblems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pagedProblems.map((p) => p.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSort = () => {
    setSortOrder((s) => (s === "newest" ? "oldest" : "newest"));
    setCurrentPage(1);
  };

  const handleFilterChange = () => setCurrentPage(1);

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Type Filter */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as ProblemType | "all");
                handleFilterChange();
              }}
              className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] pl-9 pr-4 py-2 rounded-xl font-bold text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-[#f49700] cursor-pointer"
            >
              <option value="all">All Types</option>
              {PROBLEM_TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Difficulty Filter */}
          <div className="relative">
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value as ProblemDifficulty | "all");
                handleFilterChange();
              }}
              className="appearance-none bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] pl-9 pr-4 py-2 rounded-xl font-bold text-[13px] transition-all focus:outline-none focus:ring-2 focus:ring-[#f49700] cursor-pointer"
            >
              <option value="all">All Difficulties</option>
              {PROBLEM_DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          {/* Sort Toggle */}
          <button
            onClick={toggleSort}
            className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-4 py-2 rounded-xl font-bold text-[13px] transition-all flex items-center gap-2"
          >
            <ArrowDownUp className="w-4 h-4 text-slate-500" />
            Sort: {sortOrder === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>

        <div className="text-slate-500 text-[14px] font-medium">
          Showing {filteredProblems.length} problem{filteredProblems.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[680px]">
          <thead>
            <tr className="border-b-2 border-slate-100 text-slate-400 text-[11px] font-black uppercase tracking-wider">
              {editable && (
                <th className="py-4 pl-2 pr-4 w-12">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-300 accent-[#f49700] cursor-pointer"
                    checked={pagedProblems.length > 0 && selectedIds.length === pagedProblems.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              <th className="py-4 px-4">Question Snippet</th>
              <th className="py-4 px-4 w-[15%]">Type</th>
              <th className="py-4 px-4 w-[15%]">Difficulty</th>
              <th className="py-4 pl-4 pr-2 w-[15%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedProblems.length === 0 ? (
              <tr>
                <td
                  colSpan={editable ? 5 : 4}
                  className="py-12 text-center text-slate-400 font-medium text-[14px]"
                >
                  No problems match the current filters.
                </td>
              </tr>
            ) : (
              pagedProblems.map((problem) => {
                const detailHref = problemHrefBase
                  ? `${problemHrefBase}/${problem.id}`
                  : null;

                // Strip LaTeX delimiters for a plain-text snippet
                const snippet = problem.contentLatex
                  .replace(/\$\$[\s\S]*?\$\$/g, "[math]")
                  .replace(/\$[^$]*?\$/g, "[math]")
                  .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, "")
                  .trim()
                  .slice(0, 160);

                return (
                  <tr
                    key={problem.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    {editable && (
                      <td className="py-5 pl-2 pr-4">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-slate-300 accent-[#f49700] cursor-pointer"
                          checked={selectedIds.includes(problem.id)}
                          onChange={() => toggleSelect(problem.id)}
                        />
                      </td>
                    )}

                    <td className="py-5 px-4">
                      <div className="text-[#10182b] font-semibold text-[14px] leading-relaxed line-clamp-2">
                        {snippet || "—"}
                      </div>
                      {problem.inUse && (
                        <div className="inline-flex items-center gap-1.5 mt-2 bg-[#f49700]/10 text-[#e08900] px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-3 h-3" />
                          {problem.inUse}
                        </div>
                      )}
                      {problem.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {problem.tags.slice(0, 4).map((tag, i) => (
                            <span
                              key={i}
                              className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-5 px-4">
                      <span className="inline-block bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[12px] font-bold">
                        {TYPE_LABELS[problem.type] ?? problem.type}
                      </span>
                    </td>

                    <td className="py-5 px-4">
                      <span className={`text-[13px] font-bold ${DIFFICULTY_COLORS[problem.difficulty] ?? "text-slate-500"}`}>
                        {DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}
                      </span>
                    </td>

                    <td className="py-5 pl-4 pr-2 text-right">
                      <div className="flex items-center justify-end gap-3 text-slate-300">
                        {detailHref && (
                          <ProgressLink
                            href={detailHref}
                            className="hover:text-[#f49700] transition-colors p-1"
                            title="View / Edit"
                          >
                            {editable ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </ProgressLink>
                        )}
                        {!editable && !detailHref && (
                          <span className="text-slate-200 p-1">
                            <Eye className="w-4 h-4" />
                          </span>
                        )}
                        {editable && (
                          <button
                            className="hover:text-red-500 transition-colors p-1"
                            title="Delete"
                            aria-label="Delete problem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="text-slate-500 text-[13px] font-medium">
            Page {safePage} of {totalPages}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-[#10182b] transition-all bg-white disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {pageNumbers.map((n) => (
              <button
                key={n}
                onClick={() => setCurrentPage(n)}
                className={`w-9 h-9 flex items-center justify-center rounded-xl font-bold text-[14px] transition-all ${
                  n === safePage
                    ? "bg-[#f49700] text-[#10182b] shadow-sm shadow-[#f49700]/20"
                    : "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-[#10182b] bg-white"
                }`}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-[#10182b] transition-all bg-white disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
