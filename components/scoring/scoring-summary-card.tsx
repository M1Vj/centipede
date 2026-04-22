import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  buildScoringSummaryView,
  type BuildScoringSummaryOptions,
  type ScoringSummaryContext,
} from "@/lib/scoring/summary";
import type { ScoringRuleConfig } from "@/lib/scoring/types";

interface ScoringSummaryCardProps {
  config: ScoringRuleConfig;
  context: ScoringSummaryContext;
  options?: BuildScoringSummaryOptions;
  className?: string;
}

export function ScoringSummaryCard({
  config,
  context,
  options,
  className,
}: ScoringSummaryCardProps) {
  const viewModel = buildScoringSummaryView(config, context, options);
  const isWizard = context === "wizard";

  return (
    <Card
      className={cn(
        isWizard
          ? "overflow-hidden rounded-[28px] border-[#10182b] bg-[#10182b] text-white shadow-xl"
          : "border-border/70 bg-white",
        className,
      )}
    >
      <CardHeader className={cn(isWizard ? "pb-4" : "")}>
        <CardTitle className={cn(isWizard ? "text-[18px] font-black text-white" : "")}>
          {viewModel.title}
        </CardTitle>
        <CardDescription className={cn(isWizard ? "text-[13px] font-medium leading-6 text-slate-300" : "")}>
          {viewModel.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2">
          {viewModel.lines.map((line, idx) => (
            <div
              key={`${line.label}-${idx}`}
              className={cn(
                "flex flex-col gap-1 pb-3 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4",
                isWizard ? "border-b border-white/10" : "border-b border-border/50",
              )}
            >
              <dt className={cn(isWizard ? "text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400" : "text-muted-foreground")}>
                {line.label}
              </dt>
              <dd className={cn("font-medium sm:text-right", isWizard ? "text-white" : "")}>{line.value}</dd>
            </div>
          ))}
        </dl>

        {viewModel.notices.length > 0 ? (
          <ul
            className={cn(
              "space-y-1 p-3 text-xs",
              isWizard
                ? "rounded-2xl border border-white/10 bg-white/5 text-slate-300"
                : "rounded-md bg-muted/30 text-muted-foreground",
            )}
          >
            {viewModel.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
