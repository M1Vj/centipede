import { MathletePageFrame } from "@/components/mathlete/page-frame";
import { ProgressLink } from "@/components/ui/progress-link";
import { CompetitionFilters } from "@/components/competitions/competition-filters";
import { CompetitionList } from "@/components/competitions/competition-list";
import { CompetitionPagination } from "@/components/competitions/competition-pagination";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import {
  fetchDiscoverableCompetitions,
  parseCompetitionSearchParams,
} from "@/lib/competition/discovery";
import { startDueScheduledCompetitionsSafely } from "@/lib/competition/scheduled-start";
import { listMyRegistrations } from "@/lib/registrations/api";
import { createClient } from "@/lib/supabase/server";

export default async function CompetitionDiscoveryPage({
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
  const registrationSummaries = await listMyRegistrations({
    competitionId: undefined,
  });

  const registrationLookup = registrationSummaries.reduce<
    Record<string, { status: string | null; statusReason: string | null; teamId: string | null; id: string }>
  >((accumulator, registration) => {
    if (!result.competitions.find((competition) => competition.id === registration.competition_id)) {
      return accumulator;
    }

    accumulator[registration.competition_id] = {
      status: registration.status ?? null,
      statusReason: registration.status_reason ?? null,
      teamId: registration.team_id ?? null,
      id: registration.id,
    };
    return accumulator;
  }, {});

  return (
    <MathletePageFrame
      eyebrow="Competition discovery"
      title="Find your next challenge"
      description="Browse live and upcoming competitions, filter by format, and register when you're ready."
      actions={
        <ProgressLink
          href="/mathlete/competition/calendar"
          className="rounded-full bg-[#f49700] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e08900]"
        >
          Open calendar
        </ProgressLink>
      }
    >
      <div className="space-y-6">
        <CompetitionFilters actionPath="/mathlete/competition" filters={result.filters} total={result.total} />
        <CompetitionList competitions={result.competitions} registrationLookup={registrationLookup} />
        <CompetitionPagination
          filters={result.filters}
          page={result.page}
          pageCount={result.pageCount}
          basePath="/mathlete/competition"
        />
      </div>
    </MathletePageFrame>
  );
}
