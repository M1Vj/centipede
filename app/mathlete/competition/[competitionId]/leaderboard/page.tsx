import { notFound } from "next/navigation";
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
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <header className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-black text-[#0f1c2c]">Top standings</h2>
            <p className="mt-1 text-sm text-slate-500">
              {leaderboardView.entries.length} participant{leaderboardView.entries.length === 1 ? "" : "s"} ranked
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-3">Rank</th>
                  <th className="px-6 py-3">Participant</th>
                  <th className="px-6 py-3">Score</th>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Offenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {leaderboardView.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-6 py-4 font-bold text-[#10182b]">#{entry.rank}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{entry.displayName}</td>
                    <td className="px-6 py-4 text-slate-700">{entry.score.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-700">{entry.totalTimeSeconds}s</td>
                    <td className="px-6 py-4 text-slate-700">{entry.offenseCount}</td>
                  </tr>
                ))}
                {leaderboardView.entries.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-slate-500" colSpan={5}>
                      No leaderboard entries yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </MathletePageFrame>
  );
}
