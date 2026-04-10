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

  return (
    <Card className={cn("border-border/70", className)}>
      <CardHeader>
        <CardTitle>{viewModel.title}</CardTitle>
        <CardDescription>{viewModel.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="space-y-2">
          {viewModel.lines.map((line, idx) => (
            <div
              key={`${line.label}-${idx}`}
              className="flex flex-col gap-1 border-b border-border/50 pb-2 text-sm sm:flex-row sm:items-start sm:justify-between sm:gap-4"
            >
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="font-medium sm:text-right">{line.value}</dd>
            </div>
          ))}
        </dl>

        {viewModel.notices.length > 0 ? (
          <ul className="space-y-1 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
            {viewModel.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
