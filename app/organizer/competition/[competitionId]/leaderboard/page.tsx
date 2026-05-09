import { notFound } from "next/navigation";
import { LeaderboardManagementPanel } from "@/components/organizer/leaderboard-management-panel";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { listCompetitionDisputes } from "@/lib/disputes/api";
import { listCompetitionExportJobs } from "@/lib/exports/api";
import { loadOrganizerCompetitionLeaderboard } from "@/lib/leaderboard/api";

export default async function OrganizerCompetitionLeaderboardPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const { competitionId } = await params;

  if (!profile) {
    notFound();
  }

  const [leaderboard, disputes, exportJobs] = await Promise.all([
    loadOrganizerCompetitionLeaderboard({
      competitionId,
      organizerId: profile.id,
    }),
    listCompetitionDisputes({ competitionId }),
    listCompetitionExportJobs({ competitionId }),
  ]);

  if (!leaderboard.competition) {
    notFound();
  }

  return (
    <div className="w-full flex justify-center px-4">
      <div className="w-full max-w-[1024px] mt-12 flex flex-col pb-12 font-['Poppins']">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#10182b]">
              {leaderboard.competition.name || "Competition leaderboard"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Publish standings, handle disputes, and queue leaderboard export history.
            </p>
          </div>
          <ProgressLink
            href={`/organizer/competition/${competitionId}`}
            className="self-start rounded-xl bg-[#10182b] px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 md:self-auto"
          >
            Back to competition
          </ProgressLink>
        </div>

        <div className="mt-8">
          <LeaderboardManagementPanel
            competitionId={competitionId}
            leaderboardPublished={leaderboard.competition.leaderboardPublished}
            format={leaderboard.competition.format}
            entries={leaderboard.entries}
            disputes={disputes}
            exportJobs={exportJobs}
          />
        </div>
      </div>
    </div>
  );
}
