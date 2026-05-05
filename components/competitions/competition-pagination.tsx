import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { buildCompetitionSearchParams, type CompetitionSearchFilters } from "@/lib/competition/discovery";

type CompetitionPaginationProps = {
  filters: CompetitionSearchFilters;
  page: number;
  pageCount: number;
  basePath: string;
};

export function CompetitionPagination({ filters, page, pageCount, basePath }: CompetitionPaginationProps) {
  if (pageCount <= 1) {
    return null;
  }

  const previousParams = buildCompetitionSearchParams(filters, Math.max(1, page - 1));
  const nextParams = buildCompetitionSearchParams(filters, Math.min(pageCount, page + 1));

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-100 bg-white px-6 py-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-3">
        <ProgressLink
          href={`${basePath}?${previousParams.toString()}`}
          aria-disabled={page === 1}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
            page === 1
              ? "cursor-not-allowed border-2 border-slate-200 bg-white text-slate-400"
              : "border-2 border-slate-200 bg-white text-[#0f1c2c] hover:bg-slate-50"
          }`}
        >
          <ChevronLeft className="size-4" />
          Previous
        </ProgressLink>
        <ProgressLink
          href={`${basePath}?${nextParams.toString()}`}
          aria-disabled={page === pageCount}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${
            page === pageCount
              ? "cursor-not-allowed border-2 border-slate-200 bg-white text-slate-400"
              : "border-2 border-slate-200 bg-white text-[#0f1c2c] hover:bg-slate-50"
          }`}
        >
          Next
          <ChevronRight className="size-4" />
        </ProgressLink>
      </div>
    </div>
  );
}
