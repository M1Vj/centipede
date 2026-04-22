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
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-slate-200 bg-white px-6 py-4">
      <p className="text-sm font-semibold text-slate-500">
        Page {page} of {pageCount}
      </p>
      <div className="flex items-center gap-3">
        <ProgressLink
          href={`${basePath}?${previousParams.toString()}`}
          aria-disabled={page === 1}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            page === 1
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-[#1a1e2e] text-white"
          }`}
        >
          <ChevronLeft className="size-4" />
          Previous
        </ProgressLink>
        <ProgressLink
          href={`${basePath}?${nextParams.toString()}`}
          aria-disabled={page === pageCount}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
            page === pageCount
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-[#1a1e2e] text-white"
          }`}
        >
          Next
          <ChevronRight className="size-4" />
        </ProgressLink>
      </div>
    </div>
  );
}
