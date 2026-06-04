import { MathletePageFrame } from "@/components/mathlete/page-frame";
import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { listMathleteHistory } from "@/lib/history/api";

export default async function MathleteHistoryPage() {
  const { profile } = await getWorkspaceContext({ requireRole: "mathlete" });
  const history = profile ? await listMathleteHistory({ profileId: profile.id }) : [];

  return (
    <MathletePageFrame
      eyebrow="History"
      title="Competition history"
      description="Review your registration timeline, outcomes, and visible leaderboard metrics."
      actions={
        <ProgressLink
          href="/mathlete/competition"
          className="rounded-full bg-[#f49700] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e08900]"
        >
          Browse competitions
        </ProgressLink>
      }
    >
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-6 py-3">Competition</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Rank</th>
                <th className="px-6 py-3">Score</th>
                <th className="px-6 py-3">Updated</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {history.map((item) => (
                <tr key={item.registrationId}>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{item.competitionName}</p>
                    <p className="text-xs uppercase tracking-[0.08em] text-slate-500">
                      {item.competitionType}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                      {item.registrationStatus ?? "unknown"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {item.hideLeaderboardMetrics ? "Hidden" : item.rank ? `#${item.rank}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-700">
                    {item.hideLeaderboardMetrics
                      ? "Hidden"
                      : item.score !== null
                        ? item.score.toLocaleString()
                        : "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(item.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <ProgressLink
                        href={`/mathlete/competition/${item.competitionId}/leaderboard`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-700 hover:border-slate-400"
                      >
                        View leaderboard
                      </ProgressLink>
                      <ProgressLink
                        href={`/mathlete/competition/${item.competitionId}/answer-key`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-700 hover:border-slate-400"
                      >
                        Answer key
                      </ProgressLink>
                    </div>
                  </td>
                </tr>
              ))}
              {history.length === 0 ? (
                <tr>
                  <td className="px-6 py-10 text-center text-slate-500" colSpan={6}>
                    No competition history yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </MathletePageFrame>
  );
}
