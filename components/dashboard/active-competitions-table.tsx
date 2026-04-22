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
  competitions = [],
}: {
  className?: string;
  competitions?: OrganizerCompetitionRow[];
}) {
  return (
    <section className={cn("organizer-panel flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-[16px] font-bold text-foreground">Active Competition Management</h2>
          <p className="mt-0.5 text-[12px] text-foreground/55">Live roster, status, and registration pulse.</p>
        </div>
        <ProgressLink href="/organizer/competition" className="organizer-nav-chip organizer-nav-chip-inactive px-3 py-1.5 text-[13px]">
          View All
        </ProgressLink>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left">
          <thead>
            <tr>
              <th className="w-[35%] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/40">Competition Name</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/40">Status</th>
              <th className="w-[25%] px-5 py-3 text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/40">Registered</th>
              <th className="px-5 py-3 text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/40">Date</th>
              <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-[0.5px] text-foreground/40">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {competitions.length > 0 ? (
              competitions.map((competition) => {
                const capacity = competition.capacity ?? Math.max(competition.registrationCount, 1);
                const ratio = Math.min(100, Math.round((competition.registrationCount / Math.max(capacity, 1)) * 100));

                return (
                  <tr key={competition.id} className="transition-colors hover:bg-secondary/50">
                    <td className="px-5 py-4">
                      <div className="mb-0.5 font-bold text-[14px] text-foreground">{competition.name}</div>
                      <div className="text-[12px] font-medium text-foreground/55">{competition.subtitle}</div>
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide", statusClassMap[competition.status])}>
                        {competition.status === "published" ? "SCHEDULED" : competition.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${ratio}%` }} />
                        </div>
                        <div className="text-[12px] font-semibold text-foreground/65">
                          {competition.registrationCount}/{competition.capacity ?? "Open"}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-medium text-foreground/65">{competition.dateLabel}</td>
                    <td className="px-5 py-4 text-right">
                      <ProgressLink
                        href={competition.href}
                        className="inline-flex p-1.5 text-foreground/40 transition-colors hover:text-foreground"
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
                <td colSpan={5} className="px-5 py-10 text-center text-sm text-foreground/45">
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
