import {
  ATTEMPT_GRADING_MODE_ALIASES,
  PENALTY_MODE_ALIASES,
  SCORING_MODE_ALIASES,
  TIE_BREAKER_ALIASES,
  type AttemptGradingMode,
  type CompetitionType,
  type OffensePenaltyKind,
  type OffensePenaltyRule,
  type PenaltyMode,
  type ScoringMode,
  type ScoringRuleConfig,
  type TieBreaker,
} from "./types";

const OFFENSE_PENALTY_KINDS: readonly OffensePenaltyKind[] = [
  "warning",
  "deduction",
  "forced_submit",
  "disqualification",
];

export interface ScoringValidationError {
  field: string;
  reason: string;
}

export interface ScoringValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: ScoringValidationError[];
}

export interface ScoringRuleInput {
  scoringMode?: unknown;
  penaltyMode?: unknown;
  deductionValue?: unknown;
  tieBreaker?: unknown;
  multiAttemptGradingMode?: unknown;
  competitionType?: unknown;
  shuffleQuestions?: unknown;
  shuffleOptions?: unknown;
  logTabSwitch?: unknown;
  offensePenalties?: unknown;
  customPointsByProblemId?: unknown;
}

function ok<T>(value: T): ScoringValidationResult<T> {
  return {
    ok: true,
    value,
    errors: [],
  };
}

function fail<T>(errors: ScoringValidationError[]): ScoringValidationResult<T> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

function normalizeToken(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const token = value.trim().toLowerCase();
    if (token === "true") {
      return true;
    }

    if (token === "false") {
      return false;
    }
  }

  return fallback;
}

function normalizeNonNegativeInteger(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }

  return fallback;
}

function normalizeCompetitionType(value: unknown): CompetitionType | null {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeToken(value) === "open" ? "open" : "scheduled";
}

export function createDefaultScoringRuleConfig(): ScoringRuleConfig {
  return {
    scoringMode: "difficulty",
    penaltyMode: "none",
    deductionValue: 0,
    tieBreaker: "earliest_final_submission",
    multiAttemptGradingMode: "highest_score",
    shuffleQuestions: false,
    shuffleOptions: false,
    logTabSwitch: false,
    offensePenalties: [],
    customPointsByProblemId: {},
  };
}

export function normalizeScoringModeToken(value: unknown): ScoringMode | null {
  const normalized = normalizeToken(value);
  return SCORING_MODE_ALIASES[normalized] ?? null;
}

export function normalizePenaltyModeToken(value: unknown): PenaltyMode | null {
  const normalized = normalizeToken(value);
  return PENALTY_MODE_ALIASES[normalized] ?? null;
}

export function normalizeTieBreakerToken(value: unknown): TieBreaker | null {
  const normalized = normalizeToken(value);
  return TIE_BREAKER_ALIASES[normalized] ?? null;
}

export function normalizeAttemptGradingModeToken(
  value: unknown,
): AttemptGradingMode | null {
  const normalized = normalizeToken(value);
  return ATTEMPT_GRADING_MODE_ALIASES[normalized] ?? null;
}

function validateOffensePenaltyRules(value: unknown): ScoringValidationResult<OffensePenaltyRule[]> {
  if (value === undefined || value === null) {
    return ok([]);
  }

  if (!Array.isArray(value)) {
    return fail([
      {
        field: "offensePenalties",
        reason: "Offense penalties must be an array.",
      },
    ]);
  }

  const errors: ScoringValidationError[] = [];
  const normalizedRules: OffensePenaltyRule[] = [];

  value.forEach((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      errors.push({
        field: "offensePenalties",
        reason: `Penalty rule ${index + 1} must be an object.`,
      });
      return;
    }

    const record = entry as Record<string, unknown>;
    const threshold = normalizeNonNegativeInteger(record.threshold, -1);
    const penaltyKind = normalizeToken(record.penaltyKind) as OffensePenaltyKind;
    const deductionValue = normalizeNonNegativeInteger(record.deductionValue, 0);

    if (threshold < 1) {
      errors.push({
        field: "offensePenalties",
        reason: `Penalty rule ${index + 1} must have threshold >= 1.`,
      });
      return;
    }

    if (!OFFENSE_PENALTY_KINDS.includes(penaltyKind)) {
      errors.push({
        field: "offensePenalties",
        reason: `Penalty rule ${index + 1} has an invalid penalty kind.`,
      });
      return;
    }

    if (penaltyKind === "deduction" && deductionValue <= 0) {
      errors.push({
        field: "offensePenalties",
        reason: `Penalty rule ${index + 1} requires deductionValue > 0 when penaltyKind is deduction.`,
      });
      return;
    }

    normalizedRules.push({
      threshold,
      penaltyKind,
      deductionValue,
    });
  });

  if (errors.length > 0) {
    return fail(errors);
  }

  const seenThresholds = new Set<number>();
  const deduped = normalizedRules
    .sort((left, right) => left.threshold - right.threshold)
    .filter((rule) => {
      if (seenThresholds.has(rule.threshold)) {
        return false;
      }

      seenThresholds.add(rule.threshold);
      return true;
    });

  return ok(deduped);
}

function validateCustomPointsByProblemId(
  value: unknown,
): ScoringValidationResult<Record<string, number>> {
  if (value === undefined || value === null) {
    return ok({});
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return fail([
      {
        field: "customPointsByProblemId",
        reason: "Custom points must be an object keyed by competition_problem_id.",
      },
    ]);
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, number> = {};
  const errors: ScoringValidationError[] = [];

  Object.entries(input).forEach(([problemId, points]) => {
    const trimmedProblemId = problemId.trim();
    if (!trimmedProblemId) {
      return;
    }

    const normalizedPoints = normalizeNonNegativeInteger(points, Number.NaN);
    if (!Number.isFinite(normalizedPoints)) {
      errors.push({
        field: "customPointsByProblemId",
        reason: `Problem ${trimmedProblemId} has an invalid point value.`,
      });
      return;
    }

    if (normalizedPoints < 0) {
      errors.push({
        field: "customPointsByProblemId",
        reason: `Problem ${trimmedProblemId} must have non-negative points.`,
      });
      return;
    }

    output[trimmedProblemId] = normalizedPoints;
  });

  if (errors.length > 0) {
    return fail(errors);
  }

  const sortedOutput: Record<string, number> = {};
  Object.keys(output)
    .sort((left, right) => left.localeCompare(right))
    .forEach((problemId) => {
      sortedOutput[problemId] = output[problemId];
    });

  return ok(sortedOutput);
}

export function validateScoringRuleInput(
  input: ScoringRuleInput,
): ScoringValidationResult<ScoringRuleConfig> {
  const defaults = createDefaultScoringRuleConfig();
  const errors: ScoringValidationError[] = [];

  const scoringMode =
    normalizeScoringModeToken(input.scoringMode) ?? defaults.scoringMode;
  if (input.scoringMode !== undefined && normalizeScoringModeToken(input.scoringMode) === null) {
    errors.push({
      field: "scoringMode",
      reason: "Scoring mode must be either difficulty or custom.",
    });
  }

  const penaltyMode =
    normalizePenaltyModeToken(input.penaltyMode) ?? defaults.penaltyMode;
  if (input.penaltyMode !== undefined && normalizePenaltyModeToken(input.penaltyMode) === null) {
    errors.push({
      field: "penaltyMode",
      reason: "Penalty mode must be none or fixed_deduction.",
    });
  }

  const deductionValue = normalizeNonNegativeInteger(
    input.deductionValue,
    defaults.deductionValue,
  );

  const tieBreaker =
    normalizeTieBreakerToken(input.tieBreaker) ?? defaults.tieBreaker;
  if (input.tieBreaker !== undefined && normalizeTieBreakerToken(input.tieBreaker) === null) {
    errors.push({
      field: "tieBreaker",
      reason: "Tie-breaker must be earliest_final_submission or lowest_total_time.",
    });
  }

  const multiAttemptGradingMode =
    normalizeAttemptGradingModeToken(input.multiAttemptGradingMode) ??
    defaults.multiAttemptGradingMode;
  if (
    input.multiAttemptGradingMode !== undefined &&
    normalizeAttemptGradingModeToken(input.multiAttemptGradingMode) === null
  ) {
    errors.push({
      field: "multiAttemptGradingMode",
      reason: "Attempt grading mode must be highest_score, latest_score, or average_score.",
    });
  }

  const competitionType = normalizeCompetitionType(input.competitionType);
  if (competitionType === "scheduled" && multiAttemptGradingMode !== "highest_score") {
    errors.push({
      field: "multiAttemptGradingMode",
      reason: "Scheduled competitions must use highest_score mode.",
    });
  }

  if (penaltyMode === "fixed_deduction" && deductionValue <= 0) {
    errors.push({
      field: "deductionValue",
      reason: "Deduction value must be greater than zero when penalty mode is fixed_deduction.",
    });
  }

  const customPointsResult = validateCustomPointsByProblemId(input.customPointsByProblemId);
  if (!customPointsResult.ok || customPointsResult.value === null) {
    errors.push(...customPointsResult.errors);
  }

  const offensePenaltiesResult = validateOffensePenaltyRules(input.offensePenalties);
  if (!offensePenaltiesResult.ok || offensePenaltiesResult.value === null) {
    errors.push(...offensePenaltiesResult.errors);
  }

  const customPointsByProblemId = customPointsResult.value ?? {};
  if (scoringMode === "custom" && Object.keys(customPointsByProblemId).length === 0) {
    errors.push({
      field: "customPointsByProblemId",
      reason: "Custom scoring mode requires at least one custom points entry.",
    });
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    scoringMode,
    penaltyMode,
    deductionValue: penaltyMode === "none" ? 0 : deductionValue,
    tieBreaker,
    multiAttemptGradingMode,
    shuffleQuestions: normalizeBoolean(input.shuffleQuestions, defaults.shuffleQuestions),
    shuffleOptions: normalizeBoolean(input.shuffleOptions, defaults.shuffleOptions),
    logTabSwitch: normalizeBoolean(input.logTabSwitch, defaults.logTabSwitch),
    offensePenalties: offensePenaltiesResult.value ?? [],
    customPointsByProblemId,
  });
}
