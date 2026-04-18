import { MoreHorizontal } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";
import type { OrganizerCompetitionRow } from "@/components/dashboard/types";

const statusClassMap = {
  live: "bg-[#dcfce7] text-[#15803d]",
  published: "bg-[#dbeafe] text-[#2563eb]",
  paused: "bg-[#fef3c7] text-[#b45309]",
  draft: "bg-slate-100 text-slate-500",
  ended: "bg-violet-100 text-violet-700",
  archived: "bg-slate-100 text-slate-400",
} as const;

export function ActiveCompetitionsTable({ 
  className, 
  competitions = [] 
}: { 
  className?: string;
  competitions?: OrganizerCompetitionRow[];
}) {
  return (
    <section
      className={cn(
        "rounded-[24px] border border-slate-200/80 bg-white shadow-[0_18px_42px_-30px_rgba(15,23,42,0.42)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-5 py-5">
        <div>
          <h2 className="text-[1.35rem] font-semibold text-slate-900">
            Active Competition Management
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Current registration progress and lifecycle state.
          </p>
        </div>
        <ProgressLink
          href="/organizer/competition"
          className="text-sm font-semibold text-[#f59f0a] transition hover:text-[#d88705]"
        >
          View All
        </ProgressLink>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
              <th className="px-5 py-4">Competition Name</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Registered</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {competitions.length > 0 ? (
              competitions.map((competition) => {
                const capacity = competition.capacity ?? Math.max(competition.registrationCount, 1);
                const ratio = Math.min(
                  100,
                  Math.round((competition.registrationCount / Math.max(capacity, 1)) * 100),
                );

                return (
                  <tr
                    key={competition.id}
                    className="border-t border-slate-100 transition hover:bg-slate-50/70"
                  >
                    <td className="px-5 py-5 align-top">
                      <p className="text-base font-semibold text-slate-900">
                        {competition.name}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">{competition.subtitle}</p>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]",
                          statusClassMap[competition.status],
                        )}
                      >
                        {competition.status === "published" ? "Scheduled" : competition.status}
                      </span>
                    </td>
                    <td className="px-5 py-5 align-top">
                      <div className="space-y-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[#f59f0a]"
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <p className="text-xs font-medium text-slate-500">
                          {competition.registrationCount}/{competition.capacity ?? "Open"}
                        </p>
                      </div>
                    </td>
                    <td className="px-5 py-5 align-top text-sm text-slate-500">
                      {competition.dateLabel}
                    </td>
                    <td className="px-5 py-5 text-right align-top">
                      <ProgressLink
                        href={competition.href}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Open ${competition.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </ProgressLink>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-slate-500">
                  No competition records available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
