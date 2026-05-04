import { ProgressLink } from "@/components/ui/progress-link";
import { getWorkspaceContext } from "@/lib/auth/workspace";
import { listOrganizerHistory } from "@/lib/history/api";

export default async function OrganizerHistoryPage() {
  const { profile } = await getWorkspaceContext({ requireRole: "organizer" });
  const history = profile ? await listOrganizerHistory({ organizerId: profile.id }) : [];

  return (
    <div className="w-full flex justify-center px-4">
      <div className="w-full max-w-[1024px] mt-12 flex flex-col pb-12 font-['Poppins']">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-[34px] font-black text-[#10182b] tracking-tight leading-tight">
              Competition history
            </h1>
            <p className="text-slate-600 text-[15px] font-medium mt-2">
              Track publish state, disputes, registrations, and export workload across competitions.
            </p>
          </div>
          <ProgressLink
            href="/organizer/competition"
            className="self-start rounded-xl bg-[#10182b] px-5 py-2 text-sm font-bold text-white hover:bg-slate-800 md:self-auto"
          >
            Back to competitions
          </ProgressLink>
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-6 py-3">Competition</th>
                  <th className="px-6 py-3">State</th>
                  <th className="px-6 py-3">Leaderboard</th>
                  <th className="px-6 py-3">Registrations</th>
                  <th className="px-6 py-3">Disputes</th>
                  <th className="px-6 py-3">Exports</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {history.map((item) => (
                  <tr key={item.competitionId}>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{item.competitionName}</p>
                      <p className="text-xs uppercase tracking-[0.08em] text-slate-500">{item.type}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-700">
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {item.leaderboardPublished ? "Published" : "Unpublished"}
                    </td>
                    <td className="px-6 py-4 text-slate-700">{item.registrationCount}</td>
                    <td className="px-6 py-4 text-slate-700">{item.disputeCount}</td>
                    <td className="px-6 py-4 text-slate-700">{item.exportCount}</td>
                    <td className="px-6 py-4">
                      <ProgressLink
                        href={`/organizer/competition/${item.competitionId}/leaderboard`}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-slate-700 hover:border-slate-400"
                      >
                        Manage
                      </ProgressLink>
                    </td>
                  </tr>
                ))}
                {history.length === 0 ? (
                  <tr>
                    <td className="px-6 py-10 text-center text-slate-500" colSpan={7}>
                      No competition history yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
