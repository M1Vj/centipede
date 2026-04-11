"use client";

import type { CompetitionType, ScoringRuleConfig } from "@/lib/scoring/types";
import type { ScoringValidationError } from "@/lib/scoring/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface OrganizerScoringRuleControlsProps {
  value: ScoringRuleConfig;
  competitionType: CompetitionType;
  onChange: (nextValue: ScoringRuleConfig) => void;
  validationErrors?: ScoringValidationError[];
  disabled?: boolean;
}

function fieldError(
  validationErrors: readonly ScoringValidationError[] | undefined,
  field: string,
): string | null {
  if (!validationErrors) {
    return null;
  }

  const match = validationErrors.find((error) => error.field === field);
  return match?.reason ?? null;
}

export function OrganizerScoringRuleControls({
  value,
  competitionType,
  onChange,
  validationErrors,
  disabled = false,
}: OrganizerScoringRuleControlsProps) {
  const scoringModeError = fieldError(validationErrors, "scoringMode");
  const penaltyModeError = fieldError(validationErrors, "penaltyMode");
  const deductionValueError = fieldError(validationErrors, "deductionValue");
  const tieBreakerError = fieldError(validationErrors, "tieBreaker");
  const attemptModeError = fieldError(validationErrors, "multiAttemptGradingMode");
  const customPointsError = fieldError(validationErrors, "customPointsByProblemId");
  const offensePenaltiesError = fieldError(validationErrors, "offensePenalties");

  const scoringModeErrorId = scoringModeError ? "scoring-mode-error" : undefined;
  const tieBreakerErrorId = tieBreakerError ? "tie-breaker-error" : undefined;
  const penaltyModeErrorId = penaltyModeError ? "penalty-mode-error" : undefined;
  const deductionValueErrorId = deductionValueError ? "deduction-value-error" : undefined;
  const attemptModeErrorId = attemptModeError ? "attempt-mode-error" : undefined;
  const customPointsErrorId = customPointsError ? "custom-points-error" : undefined;
  const offensePenaltiesErrorId = offensePenaltiesError ? "offense-penalties-error" : undefined;
  const offensePenaltiesHintId = "offense-penalties-hint";
  const offensePenaltiesDescribedBy = [offensePenaltiesHintId, offensePenaltiesErrorId]
    .filter(Boolean)
    .join(" ") || undefined;
  const customPointsHintId = "custom-points-hint";
  const customPointsDescribedBy = [customPointsHintId, customPointsErrorId]
    .filter(Boolean)
    .join(" ") || undefined;

  const customPointsCount = Object.keys(value.customPointsByProblemId).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring rules</CardTitle>
        <CardDescription>
          Configure scoring, penalties, tie-breakers, and multi-attempt policy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="scoringMode">Scoring mode</Label>
            <select
              id="scoringMode"
              value={value.scoringMode}
              disabled={disabled}
              aria-invalid={Boolean(scoringModeError)}
              aria-describedby={scoringModeErrorId}
              onChange={(event) =>
                onChange({
                  ...value,
                  scoringMode: event.target.value === "custom" ? "custom" : "difficulty",
                })
              }
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm md:w-auto"
            >
              <option value="difficulty">Difficulty-based (easy=1, average=2, difficult=3)</option>
              <option value="custom">Custom points</option>
            </select>
            {scoringModeError ? (
              <p id={scoringModeErrorId} className="text-xs text-destructive">
                {scoringModeError}
              </p>
            ) : null}
          </div>

          <div className="grid min-w-0 gap-2">
            <Label htmlFor="tieBreaker">Tie-breaker</Label>
            <select
              id="tieBreaker"
              value={value.tieBreaker}
              disabled={disabled}
              aria-invalid={Boolean(tieBreakerError)}
              aria-describedby={tieBreakerErrorId}
              onChange={(event) =>
                onChange({
                  ...value,
                  tieBreaker:
                    event.target.value === "lowest_total_time"
                      ? "lowest_total_time"
                      : "earliest_final_submission",
                })
              }
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm md:w-auto"
            >
              <option value="earliest_final_submission">Earliest final submission (default)</option>
              <option value="lowest_total_time">Lowest total time</option>
            </select>
            {tieBreakerError ? (
              <p id={tieBreakerErrorId} className="text-xs text-destructive">
                {tieBreakerError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-4 md:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <Label htmlFor="penaltyMode">Wrong-answer penalty</Label>
            <select
              id="penaltyMode"
              value={value.penaltyMode}
              disabled={disabled}
              aria-invalid={Boolean(penaltyModeError)}
              aria-describedby={penaltyModeErrorId}
              onChange={(event) =>
                onChange({
                  ...value,
                  penaltyMode:
                    event.target.value === "fixed_deduction"
                      ? "fixed_deduction"
                      : "none",
                })
              }
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm md:w-auto"
            >
              <option value="none">No deduction</option>
              <option value="fixed_deduction">Fixed deduction</option>
            </select>
            {penaltyModeError ? (
              <p id={penaltyModeErrorId} className="text-xs text-destructive">
                {penaltyModeError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="deductionValue">Deduction value</Label>
            <Input
              id="deductionValue"
              type="number"
              min={0}
              value={value.deductionValue}
              disabled={disabled || value.penaltyMode === "none"}
              aria-invalid={Boolean(deductionValueError)}
              aria-describedby={deductionValueErrorId}
              onChange={(event) => {
                const nextValue = Number.parseInt(event.target.value, 10);
                onChange({
                  ...value,
                  deductionValue: Number.isFinite(nextValue) ? Math.max(0, nextValue) : 0,
                });
              }}
            />
            {deductionValueError ? (
              <p id={deductionValueErrorId} className="text-xs text-destructive">
                {deductionValueError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid min-w-0 gap-2">
          <Label htmlFor="multiAttemptGradingMode">Open competition attempt policy</Label>
          <select
            id="multiAttemptGradingMode"
            value={value.multiAttemptGradingMode}
            disabled={disabled || competitionType !== "open"}
            aria-invalid={Boolean(attemptModeError)}
            aria-describedby={attemptModeErrorId}
            onChange={(event) => {
              const nextValue = event.target.value;
              onChange({
                ...value,
                multiAttemptGradingMode:
                  nextValue === "latest_score"
                    ? "latest_score"
                    : nextValue === "average_score"
                      ? "average_score"
                      : "highest_score",
              });
            }}
            className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm md:w-auto"
          >
            <option value="highest_score">Highest score</option>
            <option value="latest_score">Latest score</option>
            <option value="average_score">Average score (rounded once to 2 decimals)</option>
          </select>
          {competitionType !== "open" ? (
            <p className="text-xs text-muted-foreground">
              Scheduled competitions use single-attempt highest score.
            </p>
          ) : null}
          {attemptModeError ? (
            <p id={attemptModeErrorId} className="text-xs text-destructive">
              {attemptModeError}
            </p>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.shuffleQuestions}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, shuffleQuestions: event.target.checked })}
            />
            Shuffle questions
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.shuffleOptions}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, shuffleOptions: event.target.checked })}
            />
            Shuffle options
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={value.logTabSwitch}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, logTabSwitch: event.target.checked })}
            />
            Log tab switch offenses
          </label>
        </div>

        <fieldset
          className="space-y-3 rounded-md border border-border/70 p-3"
          aria-invalid={Boolean(offensePenaltiesError)}
          aria-describedby={offensePenaltiesDescribedBy}
        >
          <legend className="text-sm font-medium">Offense penalties</legend>
          <p id={offensePenaltiesHintId} className="text-xs text-muted-foreground">
            Applied when tab-switch logging is enabled and thresholds are reached.
          </p>

          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...value,
                  offensePenalties: [
                    ...value.offensePenalties,
                    {
                      threshold: 1,
                      penaltyKind: "warning",
                      deductionValue: 0,
                    },
                  ],
                })
              }
            >
              Add rule
            </Button>
          </div>

          {value.offensePenalties.length === 0 ? (
            <p className="text-xs text-muted-foreground">No offense penalties configured.</p>
          ) : (
            <div className="space-y-3">
              {value.offensePenalties.map((rule, index) => (
                <div key={`${rule.threshold}-${index}`} className="grid min-w-0 gap-3 rounded-md border border-border/60 p-3 md:grid-cols-4">
                  <div className="grid gap-1">
                    <Label htmlFor={`offense-threshold-${index}`}>Threshold</Label>
                    <Input
                      id={`offense-threshold-${index}`}
                      type="number"
                      min={1}
                      value={rule.threshold}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextThreshold = Number.parseInt(event.target.value, 10);
                        onChange({
                          ...value,
                          offensePenalties: value.offensePenalties.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  threshold: Number.isFinite(nextThreshold)
                                    ? Math.max(1, nextThreshold)
                                    : 1,
                                }
                              : entry,
                          ),
                        });
                      }}
                    />
                  </div>

                  <div className="grid min-w-0 gap-1">
                    <Label htmlFor={`offense-kind-${index}`}>Penalty kind</Label>
                    <select
                      id={`offense-kind-${index}`}
                      value={rule.penaltyKind}
                      disabled={disabled}
                      onChange={(event) => {
                        const nextKind = event.target.value;
                        onChange({
                          ...value,
                          offensePenalties: value.offensePenalties.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  penaltyKind:
                                    nextKind === "deduction"
                                      ? "deduction"
                                      : nextKind === "forced_submit"
                                        ? "forced_submit"
                                        : nextKind === "disqualification"
                                          ? "disqualification"
                                          : "warning",
                                  deductionValue: nextKind === "deduction" ? entry.deductionValue : 0,
                                }
                              : entry,
                          ),
                        });
                      }}
                      className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm md:w-auto"
                    >
                      <option value="warning">Warning</option>
                      <option value="deduction">Deduction</option>
                      <option value="forced_submit">Forced submit</option>
                      <option value="disqualification">Disqualification</option>
                    </select>
                  </div>

                  <div className="grid gap-1">
                    <Label htmlFor={`offense-deduction-${index}`}>Deduction value</Label>
                    <Input
                      id={`offense-deduction-${index}`}
                      type="number"
                      min={0}
                      value={rule.deductionValue}
                      disabled={disabled || rule.penaltyKind !== "deduction"}
                      onChange={(event) => {
                        const nextDeductionValue = Number.parseInt(event.target.value, 10);
                        onChange({
                          ...value,
                          offensePenalties: value.offensePenalties.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  deductionValue: Number.isFinite(nextDeductionValue)
                                    ? Math.max(0, nextDeductionValue)
                                    : 0,
                                }
                              : entry,
                          ),
                        });
                      }}
                    />
                  </div>

                  <div className="flex items-end justify-start md:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() =>
                        onChange({
                          ...value,
                          offensePenalties: value.offensePenalties.filter(
                            (_, entryIndex) => entryIndex !== index,
                          ),
                        })
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {offensePenaltiesError ? (
            <p id={offensePenaltiesErrorId} className="text-xs text-destructive">
              {offensePenaltiesError}
            </p>
          ) : null}
        </fieldset>

        {value.scoringMode === "custom" ? (
          <fieldset
            className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm"
            aria-invalid={Boolean(customPointsError)}
            aria-describedby={customPointsDescribedBy}
          >
            <legend className="font-medium">Custom points</legend>
            <p id={customPointsHintId} className="mt-1 text-sm">
              Custom points configured: {customPointsCount}
            </p>
            <p className="text-xs text-muted-foreground">
              Per-problem custom points are configured in the problem-selection step.
            </p>
            {customPointsError ? (
              <p id={customPointsErrorId} className="mt-2 text-xs text-destructive">
                {customPointsError}
              </p>
            ) : null}
          </fieldset>
        ) : null}
      </CardContent>
    </Card>
  );
}
