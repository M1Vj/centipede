import { MathletePageFrame } from "@/components/mathlete/page-frame";
import { ProgressLink } from "@/components/ui/progress-link";
import { CompetitionCalendar } from "@/components/competitions/competition-calendar";
import { CompetitionFilters } from "@/components/competitions/competition-filters";
import { CompetitionPagination } from "@/components/competitions/competition-pagination";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  fetchDiscoverableCompetitions,
  parseCompetitionSearchParams,
} from "@/lib/competition/discovery";
import { startDueScheduledCompetitionsSafely } from "@/lib/competition/scheduled-start";
import { createClient } from "@/lib/supabase/server";

export default async function CompetitionCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await getWorkspaceContext({ requireRole: "mathlete" });
  const supabase = await createClient();
  const resolvedSearchParams = await searchParams;

  await startDueScheduledCompetitionsSafely();

  const { filters, page, pageSize } = parseCompetitionSearchParams(resolvedSearchParams ?? {});
  const result = await fetchDiscoverableCompetitions(supabase, filters, page, pageSize);

  return (
    <MathletePageFrame
      eyebrow="Competition calendar"
      title="Schedule in your timezone"
      description="All competition times render in your local timezone. Use filters to focus on the events that matter."
      actions={
        <ProgressLink
          href="/mathlete/competition"
          className="rounded-full bg-[#1a1e2e] px-5 py-2 text-sm font-semibold text-white hover:bg-[#0f121a]"
        >
          Back to list
        </ProgressLink>
      }
    >
      <div className="space-y-6">
        <CompetitionFilters actionPath="/mathlete/competition/calendar" filters={result.filters} total={result.total} />
        <CompetitionCalendar competitions={result.competitions} />
        <CompetitionPagination
          filters={result.filters}
          page={result.page}
          pageCount={result.pageCount}
          basePath="/mathlete/competition/calendar"
        />
      </div>
    </MathletePageFrame>
  );
}
