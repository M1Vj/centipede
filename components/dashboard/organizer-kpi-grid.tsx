import { Activity, BookCopy, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerDashboardMetric } from "@/components/dashboard/types";

const iconMap = {
  active: Activity,
  participants: Users2,
  bank: BookCopy,
} as const;

const toneMap = {
  default:
    "bg-[#f59f0a] text-slate-950",
  success:
    "bg-[#dcfce7] text-[#15803d]",
} as const;

interface OrganizerKpiGridProps {
  metrics: OrganizerDashboardMetric[];
}

export function OrganizerKpiGrid({ metrics }: OrganizerKpiGridProps) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = iconMap[metric.id as keyof typeof iconMap] ?? Activity;

        return (
          <article
            key={metric.id}
            className="rounded-[24px] border border-slate-200/80 bg-white px-5 py-5 shadow-[0_18px_42px_-30px_rgba(15,23,42,0.42)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f59f0a] text-slate-950 shadow-[0_10px_25px_-16px_rgba(245,159,10,0.9)]">
                <Icon className="size-5" />
              </div>
              <span
                className={cn(
                  "inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em]",
                  toneMap[metric.tone],
                )}
              >
                {metric.hint}
              </span>
            </div>
            <p className="mt-5 text-sm font-medium text-slate-600">{metric.label}</p>
            <p className="mt-2 text-[2rem] font-semibold leading-none text-slate-900">
              {metric.value}
            </p>
          </article>
        );
      })}
    </div>
  );
}
