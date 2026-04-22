import { Activity, FileText, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganizerDashboardMetric } from "@/components/dashboard/types";

const iconMap = {
  active: Activity,
  participants: Users,
  bank: FileText,
} as const;

export function OrganizerKpiGrid({
  metrics,
}: {
  metrics: OrganizerDashboardMetric[];
}) {
  return (
    <div className="grid gap-5 md:grid-cols-3">
      {metrics.map((metric) => {
        const Icon = iconMap[metric.id as keyof typeof iconMap] ?? Activity;

        return (
          <article key={metric.id} className="organizer-panel organizer-panel-hover overflow-hidden p-5">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-primary/10">
                <Icon className="w-[18px] h-[18px]" />
              </div>
              <span
                className={cn(
                  metric.tone === "success"
                    ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                    : "organizer-muted-kicker",
                )}
              >
                {metric.tone === "success" ? `+${metric.hint.match(/\d+/)?.[0] ?? "12"}%` : metric.hint}
              </span>
            </div>
            <p className="mb-1.5 text-[13px] font-medium text-foreground/70">{metric.label}</p>
            <h3 className="text-3xl font-bold leading-none text-foreground">{metric.value}</h3>
          </article>
        );
      })}
    </div>
  );
}
