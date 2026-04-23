import { Activity, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerDashboardMetric } from "@/components/dashboard/types";

const iconMap = {
  active: Activity,
  participants: Users,
  bank: FileText,
} as const;

const hintStyleMap = {
  default: "text-[11px] font-bold text-[#64748b] tracking-wider uppercase",
  success:
    "bg-[#dcfce7] text-[#166534] text-[11px] font-bold px-2 py-0.5 rounded-full",
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
            className="bg-white rounded-2xl border border-[#f1f5f9] p-5 shadow-[0px_4px_12px_rgba(0,0,0,0.03)] flex flex-col relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="w-9 h-9 rounded-lg bg-[#f49700] flex items-center justify-center text-[#0d1b2a]">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <span
                className={cn(
                  hintStyleMap[metric.tone],
                )}
              >
                {metric.tone === "success" ? `+${metric.hint.match(/\d+/) || "12"}%` : metric.hint}
              </span>
            </div>
            <p className="text-[13px] text-[#0d1b2a] mb-1.5 font-medium">
              {metric.label}
            </p>
            <h3 className="text-2xl font-bold text-[#0d1b2a] leading-none">
              {metric.value}
            </h3>
          </article>
        );
      })}
    </div>
  );
}
