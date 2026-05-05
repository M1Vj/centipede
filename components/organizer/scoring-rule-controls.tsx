"use client";

import { AlertCircle, Check, Edit3, ExternalLink, Info, ShieldAlert, Zap } from "lucide-react";
import type { CompetitionType, ScoringRuleConfig } from "@/lib/scoring/types";
import type { ScoringValidationError } from "@/lib/scoring/validation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface OrganizerScoringRuleControlsProps {
  value: ScoringRuleConfig;
  competitionType: CompetitionType;
  onChange: (nextValue: ScoringRuleConfig) => void;
  validationErrors?: ScoringValidationError[];
  disabled?: boolean;
  safeExamBrowserConfigHref?: string | null;
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

function ToggleRow({
  checked,
  description,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 transition-colors hover:border-slate-300">
      <div className="space-y-1">
        <p className="text-sm font-bold text-[#10182b]">{label}</p>
        <p className="text-xs font-medium leading-5 text-slate-500">{description}</p>
      </div>
      <span
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-[#f49700]" : "bg-slate-200",
          disabled ? "opacity-60" : "",
        )}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </label>
  );
}

export function OrganizerScoringRuleControls({
  value,
  competitionType,
  onChange,
  validationErrors,
  disabled = false,
  safeExamBrowserConfigHref = null,
}: OrganizerScoringRuleControlsProps) {
  const scoringModeError = fieldError(validationErrors, "scoringMode");
  const penaltyModeError = fieldError(validationErrors, "penaltyMode");
  const deductionValueError = fieldError(validationErrors, "deductionValue");
  const tieBreakerError = fieldError(validationErrors, "tieBreaker");
  const attemptModeError = fieldError(validationErrors, "multiAttemptGradingMode");
  const customPointsError = fieldError(validationErrors, "customPointsByProblemId");
  const offensePenaltiesError = fieldError(validationErrors, "offensePenalties");
  const safeExamBrowserModeError = fieldError(validationErrors, "safeExamBrowserMode");
  const safeExamBrowserHashesError = fieldError(validationErrors, "safeExamBrowserConfigKeyHashes");

  const scoringModeErrorId = scoringModeError ? "scoring-mode-error" : undefined;
  const tieBreakerErrorId = tieBreakerError ? "tie-breaker-error" : undefined;
  const penaltyModeErrorId = penaltyModeError ? "penalty-mode-error" : undefined;
  const deductionValueErrorId = deductionValueError ? "deduction-value-error" : undefined;
  const attemptModeErrorId = attemptModeError ? "attempt-mode-error" : undefined;
  const customPointsErrorId = customPointsError ? "custom-points-error" : undefined;
  const offensePenaltiesErrorId = offensePenaltiesError ? "offense-penalties-error" : undefined;
  const safeExamBrowserModeErrorId = safeExamBrowserModeError ? "safe-exam-browser-mode-error" : undefined;
  const offensePenaltiesHintId = "offense-penalties-hint";
  const offensePenaltiesDescribedBy = [offensePenaltiesHintId, offensePenaltiesErrorId]
    .filter(Boolean)
    .join(" ") || undefined;
  const safeExamBrowserHashesText = value.safeExamBrowserConfigKeyHashes.join("\n");
  const customPointsHintId = "custom-points-hint";
  const customPointsDescribedBy = [customPointsHintId, customPointsErrorId].filter(Boolean).join(" ") || undefined;

  const customPointsCount = Object.keys(value.customPointsByProblemId).length;

  return (
    <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-0 p-0">
        <section className="space-y-6 border-b border-slate-100 p-8">
          <div>
            <h3 className="text-[18px] font-black text-[#10182b]">Scoring mode</h3>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              Select how points are assigned across the competition.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={disabled}
              aria-describedby={scoringModeErrorId}
              className={cn(
                "rounded-2xl border-2 p-5 text-left transition-all",
                value.scoringMode === "difficulty"
                  ? "border-[#f49700] bg-[#f49700]/5 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300",
                disabled ? "cursor-not-allowed opacity-60" : "",
              )}
              onClick={() => onChange({ ...value, scoringMode: "difficulty" })}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    value.scoringMode === "difficulty" ? "bg-[#f49700]/15 text-[#f49700]" : "bg-slate-100 text-slate-500",
                  )}
                >
                  <Zap className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    value.scoringMode === "difficulty" ? "border-[#f49700]" : "border-slate-300",
                  )}
                >
                  {value.scoringMode === "difficulty" ? <span className="h-2.5 w-2.5 rounded-full bg-[#f49700]" /> : null}
                </span>
              </div>
              <p className="text-base font-semibold text-[#10182b]">Auto-level points</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Easy, average, and difficult problems use the standard 1 / 2 / 3 point contract.
              </p>
            </button>

            <button
              type="button"
              disabled={disabled}
              aria-describedby={scoringModeErrorId}
              className={cn(
                "rounded-2xl border-2 p-5 text-left transition-all",
                value.scoringMode === "custom"
                  ? "border-[#f49700] bg-[#f49700]/5 shadow-sm"
                  : "border-slate-200 bg-white hover:border-slate-300",
                disabled ? "cursor-not-allowed opacity-60" : "",
              )}
              onClick={() => onChange({ ...value, scoringMode: "custom" })}
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    value.scoringMode === "custom" ? "bg-[#f49700]/15 text-[#f49700]" : "bg-slate-100 text-slate-500",
                  )}
                >
                  <Edit3 className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border-2",
                    value.scoringMode === "custom" ? "border-[#f49700]" : "border-slate-300",
                  )}
                >
                  {value.scoringMode === "custom" ? <span className="h-2.5 w-2.5 rounded-full bg-[#f49700]" /> : null}
                </span>
              </div>
              <p className="text-base font-semibold text-[#10182b]">Manual points</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Assign custom points per selected problem from the problem selection step.
              </p>
            </button>
          </div>

          {scoringModeError ? (
            <p id={scoringModeErrorId} className="text-xs font-bold text-red-500">
              {scoringModeError}
            </p>
          ) : null}

          {value.scoringMode === "difficulty" ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
                <p className="text-sm font-medium leading-6 text-slate-600">
                  Auto-level mode follows the standard MathWiz scoring ladder and keeps scoring predictable for participants.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["Easy", "1 pt"],
                  ["Average", "2 pts"],
                  ["Difficult", "3 pts"],
                ].map(([label, points]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-black text-[#10182b]">{points}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-2xl border border-[#f49700]/20 bg-[#f49700]/5 p-4">
                <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#f49700]" />
                <p className="text-sm font-medium leading-6 text-slate-700">
                  Manual mode reads each problem&apos;s point value from the selection step. Update points there and this contract updates automatically.
                </p>
              </div>
              <div
                className="rounded-2xl border border-slate-200 bg-white p-5"
                aria-invalid={Boolean(customPointsError)}
                aria-describedby={customPointsDescribedBy}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[#10182b]">Custom points configured</p>
                    <p id={customPointsHintId} className="mt-1 text-xs font-medium text-slate-500">
                      {customPointsCount} problem{customPointsCount === 1 ? "" : "s"} have explicit custom values.
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Per problem
                  </div>
                </div>
                {customPointsError ? (
                  <p id={customPointsErrorId} className="mt-3 text-xs font-bold text-red-500">
                    {customPointsError}
                  </p>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-6 border-b border-slate-100 p-8">
          <div>
            <h3 className="text-[18px] font-black text-[#10182b]">Scoring rules</h3>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              Configure tie-breakers, deductions, and attempt behavior.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tieBreaker" className="text-[14px] font-bold text-[#10182b]">
                Tie-breaker
              </Label>
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-[#10182b] outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
              >
                <option value="earliest_final_submission">Earliest final submission</option>
                <option value="lowest_total_time">Lowest total time</option>
              </select>
              {tieBreakerError ? (
                <p id={tieBreakerErrorId} className="text-xs font-bold text-red-500">
                  {tieBreakerError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="penaltyMode" className="text-[14px] font-bold text-[#10182b]">
                Wrong-answer penalty
              </Label>
              <select
                id="penaltyMode"
                value={value.penaltyMode}
                disabled={disabled}
                aria-invalid={Boolean(penaltyModeError)}
                aria-describedby={penaltyModeErrorId}
                onChange={(event) =>
                  onChange({
                    ...value,
                    penaltyMode: event.target.value === "fixed_deduction" ? "fixed_deduction" : "none",
                  })
                }
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-[#10182b] outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
              >
                <option value="none">No deduction</option>
                <option value="fixed_deduction">Fixed deduction</option>
              </select>
              {penaltyModeError ? (
                <p id={penaltyModeErrorId} className="text-xs font-bold text-red-500">
                  {penaltyModeError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-2">
              <Label htmlFor="multiAttemptGradingMode" className="text-[14px] font-bold text-[#10182b]">
                Open competition attempt policy
              </Label>
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
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-[#10182b] outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20 disabled:opacity-60"
              >
                <option value="highest_score">Highest score</option>
                <option value="latest_score">Latest score</option>
                <option value="average_score">Average score</option>
              </select>
              {competitionType !== "open" ? (
                <p className="text-xs font-medium text-slate-500">
                  Scheduled competitions stay on single-attempt highest score.
                </p>
              ) : null}
              {attemptModeError ? (
                <p id={attemptModeErrorId} className="text-xs font-bold text-red-500">
                  {attemptModeError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="deductionValue" className="text-[14px] font-bold text-[#10182b]">
                Deduction value
              </Label>
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
                className="h-12 rounded-xl border-slate-200 bg-slate-50 text-[#10182b] focus-visible:ring-[#f49700]/30"
              />
              {deductionValueError ? (
                <p id={deductionValueErrorId} className="text-xs font-bold text-red-500">
                  {deductionValueError}
                </p>
              ) : null}
            </div>
          </div>
        </section>

        <section className="space-y-6 p-8">
          <div>
            <h3 className="text-[18px] font-black text-[#10182b]">Attempt & anti-cheat policy</h3>
            <p className="mt-1 text-[13px] font-medium text-slate-500">
              Protect competition integrity with toggles and offense rules.
            </p>
          </div>

          <div className="space-y-3">
            <ToggleRow
              checked={value.shuffleQuestions}
              disabled={disabled}
              label="Shuffle questions"
              description="Randomize the order of problems for each participant."
              onChange={(checked) => onChange({ ...value, shuffleQuestions: checked })}
            />
            <ToggleRow
              checked={value.shuffleOptions}
              disabled={disabled}
              label="Shuffle options"
              description="Randomize multiple-choice answer order where supported."
              onChange={(checked) => onChange({ ...value, shuffleOptions: checked })}
            />
            <ToggleRow
              checked={value.logTabSwitch}
              disabled={disabled}
              label="Log tab switch offenses"
              description="Track when participants leave the competition tab and apply penalties if needed."
              onChange={(checked) => onChange({ ...value, logTabSwitch: checked })}
            />
          </div>

          <fieldset
            className="space-y-4 rounded-[24px] border border-slate-200 bg-slate-50/70 p-5"
            aria-invalid={Boolean(offensePenaltiesError)}
            aria-describedby={offensePenaltiesDescribedBy}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <legend className="text-sm font-bold text-[#10182b]">Offense penalties</legend>
                <p id={offensePenaltiesHintId} className="mt-1 text-xs font-medium text-slate-500">
                  Applied after tab-switch logging is enabled and a threshold is reached.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !value.logTabSwitch}
                className="rounded-xl border-slate-200 bg-white font-bold text-[#10182b] hover:border-[#f49700] hover:bg-[#f49700]/5 hover:text-[#f49700]"
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

            {!value.logTabSwitch ? (
              <div className="flex items-start gap-3 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                <p className="text-sm font-medium leading-6 text-slate-500">
                  Enable tab-switch logging to configure warning, deduction, forced submit, or disqualification rules.
                </p>
              </div>
            ) : value.offensePenalties.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm font-medium text-slate-500">
                No offense penalties configured yet.
              </div>
            ) : (
              <div className="space-y-3">
                {value.offensePenalties.map((rule, index) => (
                  <div
                    key={`${rule.threshold}-${index}`}
                    className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[120px_minmax(0,1fr)_160px_auto]"
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`offense-threshold-${index}`} className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Threshold
                      </Label>
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
                                    threshold: Number.isFinite(nextThreshold) ? Math.max(1, nextThreshold) : 1,
                                  }
                                : entry,
                            ),
                          });
                        }}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`offense-kind-${index}`} className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Penalty kind
                      </Label>
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
                        className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-[#10182b] outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
                      >
                        <option value="warning">Warning</option>
                        <option value="deduction">Deduction</option>
                        <option value="forced_submit">Forced submit</option>
                        <option value="disqualification">Disqualification</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor={`offense-deduction-${index}`} className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                        Deduction
                      </Label>
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
                                    deductionValue: Number.isFinite(nextDeductionValue) ? Math.max(0, nextDeductionValue) : 0,
                                  }
                                : entry,
                            ),
                          });
                        }}
                        className="h-11 rounded-xl border-slate-200 bg-slate-50 disabled:bg-slate-100"
                      />
                    </div>

                    <div className="flex items-end justify-start md:justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={disabled}
                        className="rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-500"
                        onClick={() =>
                          onChange({
                            ...value,
                            offensePenalties: value.offensePenalties.filter((_, entryIndex) => entryIndex !== index),
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
              <p id={offensePenaltiesErrorId} className="flex items-center gap-2 text-xs font-bold text-red-500">
                <AlertCircle className="h-4 w-4" />
                {offensePenaltiesError}
              </p>
            ) : null}
          </fieldset>

          <div className="rounded-2xl border border-slate-200 bg-[#10182b] px-5 py-4 text-white">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-xl bg-white/10 p-2 text-[#f49700]">
                {value.logTabSwitch ? <Check className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold">Integrity summary</p>
                <p className="text-xs font-medium leading-5 text-slate-300">
                  {value.logTabSwitch
                    ? `${value.offensePenalties.length} offense rule${value.offensePenalties.length === 1 ? "" : "s"} configured for tab switching.`
                    : "Tab-switch logging is currently disabled."}
                </p>
              </div>
            </div>
          </div>

          <fieldset className="space-y-4 rounded-[24px] border border-slate-200 bg-white p-5">
            <div>
              <legend className="text-sm font-bold text-[#10182b]">Safe Exam Browser</legend>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">
                Recommended for high-stakes quizzes. When enabled, participants must open this competition through SEB.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="space-y-2">
                <Label htmlFor="safe-exam-browser-mode" className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  SEB enforcement
                </Label>
                <select
                  id="safe-exam-browser-mode"
                  value={value.safeExamBrowserMode}
                  disabled={disabled}
                  aria-invalid={Boolean(safeExamBrowserModeError)}
                  aria-describedby={safeExamBrowserModeErrorId}
                  onChange={(event) => {
                    const nextMode = event.target.value === "required" ? "required" : "off";
                    onChange({
                      ...value,
                      safeExamBrowserMode: nextMode,
                    });
                  }}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-[#10182b] outline-none transition focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20"
                >
                  <option value="off">Off</option>
                  <option value="required">Required for this quiz</option>
                </select>
                {safeExamBrowserModeError ? (
                  <p id={safeExamBrowserModeErrorId} className="text-xs font-bold text-red-500">{safeExamBrowserModeError}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="safe-exam-browser-config-key-hashes" className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Allowed Config Key hashes
                </Label>
                <textarea
                  id="safe-exam-browser-config-key-hashes"
                  value={safeExamBrowserHashesText}
                  disabled={disabled || value.safeExamBrowserMode !== "required"}
                  aria-invalid={Boolean(safeExamBrowserHashesError)}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      safeExamBrowserConfigKeyHashes: event.target.value
                        .split(/[\s,]+/)
                        .map((entry) => entry.trim().toLowerCase())
                        .filter(Boolean),
                    })
                  }
                  placeholder="Paste one 64-character SEB Config Key hash per line"
                  className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-[#10182b] outline-none transition placeholder:text-slate-400 focus:border-[#f49700] focus:ring-2 focus:ring-[#f49700]/20 disabled:bg-slate-100"
                />
                {safeExamBrowserHashesError ? (
                  <p className="text-xs font-bold text-red-500">{safeExamBrowserHashesError}</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium leading-6 text-amber-950">
              Download the quiz SEB config after creating this draft, open it in SEB Config Tool, copy the Config Key hash, then paste it here before publishing.
              {safeExamBrowserConfigHref ? (
                <a
                  href={safeExamBrowserConfigHref}
                  className="ml-2 inline-flex items-center gap-1 font-black text-[#10182b] underline-offset-4 hover:underline"
                >
                  Download quiz config
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
              <a
                href="/organizer/safe-exam-browser"
                className="ml-2 inline-flex items-center gap-1 font-black text-[#10182b] underline-offset-4 hover:underline"
              >
                View Mathwiz SEB tutorial
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </fieldset>
        </section>
      </CardContent>
    </Card>
  );
}
