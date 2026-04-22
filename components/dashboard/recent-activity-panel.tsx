import { BellRing, CheckCircle2, Trophy, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerActivityItem } from "@/components/dashboard/types";

const toneIconMap = {
  success: UserPlus,
  info: Trophy,
  default: CheckCircle2,
} as const;

const toneClassMap = {
  success: "bg-[#ecfdf5] text-[#10b981]",
  info: "bg-[#eff6ff] text-[#1d4ed8]",
  default: "bg-slate-100 text-slate-600",
} as const;

interface RecentActivityPanelProps {
  items: OrganizerActivityItem[];
}

export function RecentActivityPanel({ items }: RecentActivityPanelProps) {
  return (
    <section className="bg-white rounded-2xl border border-[#f1f5f9] p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col relative">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-[#1a1e2e] text-[14px]">Recent Activity</h3>
        <BellRing className="w-4 h-4 text-[#94a3b8]" />
      </div>

      <div className="space-y-4 mb-6">
        {items.length > 0 ? (
          items.map((item) => {
            const Icon = toneIconMap[item.tone];

            return (
              <div key={item.id} className="flex gap-3">
                <div
                  className={cn(
                    "w-10 h-10 shrink-0 rounded-full flex items-center justify-center",
                    toneClassMap[item.tone],
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col pt-0.5">
                  <p className="text-[13px] font-bold text-[#1a1e2e] leading-snug mb-0.5">
                    {item.message}
                  </p>
                  <p className="text-[11px] text-[#94a3b8] font-medium">
                    {item.timestampLabel}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex gap-3">
            <div className="w-10 h-10 shrink-0 bg-[#ecfdf5] rounded-full flex items-center justify-center text-[#10b981]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div className="flex flex-col pt-0.5">
              <p className="text-[13px] font-bold text-[#1a1e2e] leading-snug mb-0.5">
                No recent organizer activity yet.
              </p>
              <p className="text-[11px] text-[#94a3b8] font-medium">
                Activity will appear here.
              </p>
            </div>
          </div>
        )}
      </div>

      <button className="w-full py-2.5 rounded-xl border border-[#f1f5f9] text-[#64748b] font-bold text-[13px] hover:bg-slate-50 transition-colors">
        Clear All Alerts
      </button>
    </section>
  );
}
