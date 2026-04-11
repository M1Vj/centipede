import type {
  AttemptGradingMode,
  CompetitionType,
  PenaltyMode,
  ScoringMode,
  ScoringRuleConfig,
  TieBreaker,
} from "./types";

export type ScoringSummaryContext = "wizard" | "review";

export interface ScoringSummaryLine {
  label: string;
  value: string;
}

export interface ScoringSummaryViewModel {
  context: ScoringSummaryContext;
  title: string;
  description: string;
  lines: ScoringSummaryLine[];
  notices: string[];
}

export interface BuildScoringSummaryOptions {
  competitionType?: CompetitionType;
  selectedProblemCount?: number;
}

function formatScoringModeLabel(mode: ScoringMode): string {
  if (mode === "custom") {
    return "Custom points per problem";
  }

  return "Difficulty-based (easy=1, average=2, difficult=3)";
}

function formatPenaltyModeLabel(mode: PenaltyMode, deductionValue: number): string {
  if (mode === "fixed_deduction") {
    return `Fixed deduction of ${deductionValue} point(s) per wrong answer`;
  }

  return "No wrong-answer deduction";
}

function formatTieBreakerLabel(tieBreaker: TieBreaker): string {
  if (tieBreaker === "lowest_total_time") {
    return "Lowest total time";
  }

  return "Earliest final submission";
}

function formatAttemptModeLabel(mode: AttemptGradingMode): string {
  if (mode === "latest_score") {
    return "Latest score";
  }

  if (mode === "average_score") {
    return "Average score";
  }

  return "Highest score";
}

export function buildScoringSummaryView(
  config: ScoringRuleConfig,
  context: ScoringSummaryContext,
  options: BuildScoringSummaryOptions = {},
): ScoringSummaryViewModel {
  const competitionType = options.competitionType;
  const customPointCount = Object.keys(config.customPointsByProblemId).length;
  const selectedProblemCount = Math.max(0, options.selectedProblemCount ?? 0);

  const lines: ScoringSummaryLine[] = [
    {
      label: "Scoring mode",
      value: formatScoringModeLabel(config.scoringMode),
    },
    {
      label: "Penalty",
      value: formatPenaltyModeLabel(config.penaltyMode, config.deductionValue),
    },
    {
      label: "Tie-breaker",
      value: formatTieBreakerLabel(config.tieBreaker),
    },
    {
      label: "Attempt policy",
      value:
        competitionType === "scheduled"
          ? "Highest score (single-attempt scheduled mode)"
          : formatAttemptModeLabel(config.multiAttemptGradingMode),
    },
    {
      label: "Question shuffle",
      value: config.shuffleQuestions ? "Enabled" : "Disabled",
    },
    {
      label: "Option shuffle",
      value: config.shuffleOptions ? "Enabled" : "Disabled",
    },
    {
      label: "Tab-switch logging",
      value: config.logTabSwitch ? "Enabled" : "Disabled",
    },
  ];

  if (config.logTabSwitch && config.offensePenalties.length > 0) {
    const sorted = [...config.offensePenalties].sort((a, b) => a.threshold - b.threshold);
    sorted.forEach((rule) => {
      let penaltyDesc = "";
      if (rule.penaltyKind === "warning") penaltyDesc = "Warning";
      else if (rule.penaltyKind === "deduction") penaltyDesc = `-${rule.deductionValue} pts`;
      else if (rule.penaltyKind === "forced_submit") penaltyDesc = "Forced submit";
      else if (rule.penaltyKind === "disqualification") penaltyDesc = "Disqualification";

      lines.push({
        label: `Penalty at ${rule.threshold} switch${rule.threshold === 1 ? "" : "es"}`,
        value: penaltyDesc,
      });
    });
  }

  if (config.scoringMode === "custom") {
    lines.push({
      label: "Custom points configured",
      value: `${customPointCount}${selectedProblemCount > 0 ? ` of ${selectedProblemCount}` : ""} problem(s)`,
    });
  }

  const notices: string[] = [];

  if (config.scoringMode === "custom" && customPointCount === 0) {
    notices.push("Custom points are configured in the problem-selection step.");
  }

  if (config.multiAttemptGradingMode === "average_score") {
    notices.push(
      "Average score is computed once from graded final scores and rounded to 2 decimals.",
    );
  }

  if (context === "review") {
    notices.push("Penalties are applied with a zero floor, so final score never drops below zero.");
  }

  return {
    context,
    title: context === "wizard" ? "Scoring summary" : "How your score is computed",
    description:
      context === "wizard"
        ? "Review scoring before publish. Snapshot values become immutable after publish."
        : "This competition uses the publish-time scoring snapshot shown below.",
    lines,
    notices,
  };
}
