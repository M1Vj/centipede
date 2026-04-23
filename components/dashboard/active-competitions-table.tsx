import { MoreHorizontal } from "lucide-react";
import { ProgressLink } from "@/components/ui/progress-link";
import { cn } from "@/lib/utils";
import type { OrganizerCompetitionRow } from "@/components/dashboard/types";

const statusClassMap = {
  live: "bg-[#dcfce7] text-[#166534]",
  published: "bg-[#dbeafe] text-[#1e40af]",
  paused: "bg-[#fef3c7] text-[#b45309]",
  draft: "bg-[#f1f5f9] text-[#475569]",
  ended: "bg-violet-100 text-violet-700",
  archived: "bg-[#f1f5f9] text-[#475569]",
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
        "bg-white rounded-2xl border border-[#f1f5f9] shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col overflow-hidden",
        className,
      )}
    >
      <div className="px-5 py-4 border-b border-[#f8fafc] flex items-center justify-between">
        <h2 className="text-[16px] font-bold text-[#1a1e2e]">
          Active Competition Management
        </h2>
        <ProgressLink
          href="/organizer/competition"
          className="text-[#f49700] font-bold text-[13px] hover:opacity-80 transition-opacity"
        >
          View All
        </ProgressLink>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[600px] text-left border-collapse">
          <thead>
            <tr>
              <th className="px-5 py-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] w-[35%]">Competition Name</th>
              <th className="px-5 py-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.5px]">Status</th>
              <th className="px-5 py-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] w-[25%]">Registered</th>
              <th className="px-5 py-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.5px]">Date</th>
              <th className="px-5 py-3 text-[11px] font-bold text-[#94a3b8] uppercase tracking-[0.5px] text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f8fafc]">
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
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#1a1e2e] text-[14px] mb-0.5">
                        {competition.name}
                      </div>
                      <div className="text-[12px] text-[#94a3b8] font-medium">
                        {competition.subtitle}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide",
                          statusClassMap[competition.status],
                        )}
                      >
                        {competition.status === "published" ? "SCHEDULED" : competition.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-1 w-full bg-[#f1f5f9] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#f49700] rounded-full"
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                        <div className="text-[12px] font-semibold text-[#64748b]">
                          {competition.registrationCount}/{competition.capacity ?? "Open"}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-medium text-[#64748b]">
                      {competition.dateLabel}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <ProgressLink
                        href={competition.href}
                        className="text-[#94a3b8] hover:text-[#0d1b2a] transition-colors p-1.5 inline-flex"
                        aria-label={`Open ${competition.name}`}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </ProgressLink>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-[#94a3b8]">
                  No competition records available yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Fills remaining space so table looks neat */}
      <div className="flex-1 bg-white"></div>
    </section>
  );
}
