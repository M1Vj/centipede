import { Bell, BookCopy, CheckCircle2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerActivityItem } from "@/components/dashboard/types";

const toneIconMap = {
  success: CheckCircle2,
  info: Trophy,
  default: BookCopy,
} as const;

const toneClassMap = {
  success: "bg-[#ecfdf3] text-[#15803d]",
  info: "bg-[#eff6ff] text-[#1d4ed8]",
  default: "bg-slate-100 text-slate-600",
} as const;

interface RecentActivityPanelProps {
  items: OrganizerActivityItem[];
}

export function RecentActivityPanel({ items }: RecentActivityPanelProps) {
  return (
    <section className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.42)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
        <Bell className="size-4 text-slate-400" />
      </div>

      <div className="mt-4 space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const Icon = toneIconMap[item.tone];

            return (
              <div
                key={item.id}
                className="flex gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-3 py-3.5"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    toneClassMap[item.tone],
                  )}
                >
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-5 text-slate-900">
                    {item.message}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{item.timestampLabel}</p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
            No recent organizer activity yet.
          </div>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-500">
        Clear All Alerts
      </div>
    </section>
  );
}
