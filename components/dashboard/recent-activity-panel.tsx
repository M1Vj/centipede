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

export function RecentActivityPanel({ items }: { items: OrganizerActivityItem[] }) {
  return (
    <section className="organizer-panel organizer-panel-hover relative flex flex-col p-5">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-foreground">Recent Activity</h3>
        <BellRing className="w-4 h-4 text-foreground/45" />
      </div>

      <div className="mb-6 space-y-4">
        {items.length > 0 ? (
          items.map((item) => {
            const Icon = toneIconMap[item.tone];

            return (
              <div key={item.id} className="flex gap-3">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", toneClassMap[item.tone])}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col pt-0.5">
                  <p className="mb-0.5 text-[13px] font-bold leading-snug text-foreground">{item.message}</p>
                  <p className="text-[11px] font-medium text-foreground/40">{item.timestampLabel}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <UserPlus className="w-4 h-4" />
            </div>
            <div className="flex flex-col pt-0.5">
              <p className="mb-0.5 text-[13px] font-bold leading-snug text-foreground">No recent organizer activity yet.</p>
              <p className="text-[11px] font-medium text-foreground/40">Activity will appear here.</p>
            </div>
          </div>
        )}
      </div>

      <button className="w-full rounded-xl border border-border/70 py-2.5 text-[13px] font-bold text-foreground/55 transition-colors hover:bg-secondary hover:text-foreground">
        Clear All Alerts
      </button>
    </section>
  );
}
