import { notFound } from "next/navigation";
import { LeaderboardStandings } from "@/components/leaderboard/leaderboard-standings";
import { MathletePageFrame } from "@/components/mathlete/page-frame";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { loadMathleteCompetitionLeaderboard } from "@/lib/leaderboard/api";

function visibilityMessage(reason: string | null) {
  switch (reason) {
    case "participant_context_required":
      return "Leaderboard appears after you register or submit at least one attempt.";
    case "scheduled_unpublished":
      return "Organizer has not published scheduled leaderboard yet.";
    case "competition_hidden":
      return "Competition leaderboard is not available right now.";
    default:
      return "Leaderboard is not available right now.";
  }
}

export default async function MathleteCompetitionLeaderboardPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });
  const { competitionId } = await params;

  if (!profile) {
    notFound();
  }

  const leaderboardView = await loadMathleteCompetitionLeaderboard({
    competitionId,
    profileId: profile.id,
  });

  if (!leaderboardView.competition) {
    notFound();
  }

  return (
    <MathletePageFrame
      eyebrow="Leaderboard"
      title={leaderboardView.competition.name || "Competition leaderboard"}
      description="Live ranking reflects latest visible attempt ordering and tie-break rules."
      actions={
        <ProgressLink
          href={`/mathlete/competition/${competitionId}`}
          className="rounded-full bg-[#f49700] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e08900]"
        >
          Back to competition
        </ProgressLink>
      }
    >
      {!leaderboardView.canView ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm font-medium text-amber-900">
          {visibilityMessage(leaderboardView.reason)}
        </section>
      ) : (
        <LeaderboardStandings
          entries={leaderboardView.entries}
          format={leaderboardView.competition.format}
        />
      )}
    </MathletePageFrame>
  );
}
