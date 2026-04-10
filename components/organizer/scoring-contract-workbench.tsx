"use client";

import { useMemo, useState } from "react";
import { OrganizerScoringRuleControls } from "@/components/organizer/scoring-rule-controls";
import { ScoringSummaryCard } from "@/components/scoring/scoring-summary-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { CompetitionType, ScoringRuleConfig } from "@/lib/scoring/types";
import {
  createDefaultScoringRuleConfig,
  validateScoringRuleInput,
} from "@/lib/scoring/validation";

function createInitialConfig(): ScoringRuleConfig {
  return createDefaultScoringRuleConfig();
}

export function ScoringContractWorkbench() {
  const [competitionType, setCompetitionType] = useState<CompetitionType>("open");
  const [config, setConfig] = useState<ScoringRuleConfig>(createInitialConfig);

  const validation = useMemo(
    () =>
      validateScoringRuleInput({
        ...config,
        competitionType,
      }),
    [config, competitionType],
  );

  const validationErrors = validation.ok ? [] : validation.errors;
  const normalizedConfig = validation.value ?? config;
  const configuredCustomPointsCount = Object.keys(normalizedConfig.customPointsByProblemId).length;
  const selectedProblemCount = Math.max(10, configuredCustomPointsCount);

  return (
    <div className="space-y-6">
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Scoring contract preview</CardTitle>
          <CardDescription>
            Validate scoring policies before wiring them into wizard publish flows and participant
            review surfaces.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid min-w-0 gap-2 sm:max-w-xs">
            <Label htmlFor="competitionType">Competition type</Label>
            <select
              id="competitionType"
              value={competitionType}
              onChange={(event) => {
                const nextType = event.target.value === "scheduled" ? "scheduled" : "open";
                setCompetitionType(nextType);
                if (nextType === "scheduled" && config.multiAttemptGradingMode !== "highest_score") {
                  setConfig((current) => ({
                    ...current,
                    multiAttemptGradingMode: "highest_score",
                  }));
                }
              }}
              className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm md:w-auto"
            >
              <option value="open">Open</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <OrganizerScoringRuleControls
        value={config}
        competitionType={competitionType}
        onChange={setConfig}
        validationErrors={validationErrors}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <ScoringSummaryCard
          config={normalizedConfig}
          context="wizard"
          options={{
            competitionType,
            selectedProblemCount,
          }}
        />
        <ScoringSummaryCard
          config={normalizedConfig}
          context="review"
          options={{
            competitionType,
            selectedProblemCount,
          }}
        />
      </div>

      {validationErrors.length > 0 ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base">Validation warnings</CardTitle>
            <CardDescription>
              Resolve these rule issues before publish-time snapshot freeze.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {validationErrors.map((error) => (
                <li key={`${error.field}:${error.reason}`}>
                  {error.field}: {error.reason}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
