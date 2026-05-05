import type { ProblemDifficulty, ProblemType } from "@/lib/problem-bank/types";

export const SCORING_MODES = ["difficulty", "custom"] as const;
export type ScoringMode = (typeof SCORING_MODES)[number];

export const PENALTY_MODES = ["none", "fixed_deduction"] as const;
export type PenaltyMode = (typeof PENALTY_MODES)[number];

export const TIE_BREAKERS = [
  "earliest_final_submission",
  "lowest_total_time",
] as const;
export type TieBreaker = (typeof TIE_BREAKERS)[number];

export const ATTEMPT_GRADING_MODES = [
  "highest_score",
  "latest_score",
  "average_score",
] as const;
export type AttemptGradingMode = (typeof ATTEMPT_GRADING_MODES)[number];

export type CompetitionType = "scheduled" | "open";

export const SAFE_EXAM_BROWSER_MODES = ["off", "required"] as const;
export type SafeExamBrowserMode = (typeof SAFE_EXAM_BROWSER_MODES)[number];

export const SCORING_MODE_ALIASES: Record<string, ScoringMode> = {
  difficulty: "difficulty",
  automatic: "difficulty",
  custom: "custom",
};

export const PENALTY_MODE_ALIASES: Record<string, PenaltyMode> = {
  none: "none",
  fixed_deduction: "fixed_deduction",
  deduction: "fixed_deduction",
};

export const TIE_BREAKER_ALIASES: Record<string, TieBreaker> = {
  earliest_final_submission: "earliest_final_submission",
  earliest_submission: "earliest_final_submission",
  latest_submission: "earliest_final_submission",
  lowest_total_time: "lowest_total_time",
  average_time: "lowest_total_time",
};

export const ATTEMPT_GRADING_MODE_ALIASES: Record<string, AttemptGradingMode> = {
  highest_score: "highest_score",
  latest_score: "latest_score",
  average_score: "average_score",
};

export const DIFFICULTY_BASE_POINTS: Record<ProblemDifficulty, number> = {
  easy: 1,
  average: 2,
  difficult: 3,
};

export type OffensePenaltyKind =
  | "warning"
  | "deduction"
  | "forced_submit"
  | "disqualification";

export interface OffensePenaltyRule {
  threshold: number;
  penaltyKind: OffensePenaltyKind;
  deductionValue: number;
}

export interface ScoringRuleConfig {
  scoringMode: ScoringMode;
  penaltyMode: PenaltyMode;
  deductionValue: number;
  tieBreaker: TieBreaker;
  multiAttemptGradingMode: AttemptGradingMode;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  logTabSwitch: boolean;
  offensePenalties: OffensePenaltyRule[];
  safeExamBrowserMode: SafeExamBrowserMode;
  safeExamBrowserConfigKeyHashes: string[];
  customPointsByProblemId: Record<string, number>;
}

export interface ScoringSnapshot {
  readonly scoringMode: ScoringMode;
  readonly penaltyMode: PenaltyMode;
  readonly deductionValue: number;
  readonly tieBreaker: TieBreaker;
  readonly multiAttemptGradingMode: AttemptGradingMode;
  readonly shuffleQuestions: boolean;
  readonly shuffleOptions: boolean;
  readonly logTabSwitch: boolean;
  readonly offensePenalties: readonly OffensePenaltyRule[];
  readonly safeExamBrowserMode: SafeExamBrowserMode;
  readonly safeExamBrowserConfigKeyHashes: readonly string[];
  readonly customPointsByProblemId: Readonly<Record<string, number>>;
}

export type ProblemCorrectionType = "answer_key_override" | "points_override";

export interface ActiveProblemCorrectionOverlay {
  competitionProblemId: string;
  correctionType: ProblemCorrectionType;
  correctedAnswerKeyJson: unknown;
  correctedPoints: number | null;
  supersededAt: string | null;
}

export interface EffectivePointsInput {
  basePoints: number;
  activePointsOverride: number | null;
}

export interface AttemptScoreSummary {
  attemptId: string;
  registrationId: string;
  finalScore: number;
  submittedAt: string | null;
  totalTimeSeconds: number | null;
}

export interface AttemptScoreSelection {
  mode: AttemptGradingMode;
  score: number;
  tieBreakSubmittedAt: string | null;
  tieBreakTotalTimeSeconds: number | null;
  sourceAttemptId: string | null;
}

export interface LeaderboardSortableEntry {
  registrationId: string;
  attemptId: string | null;
  score: number;
  submittedAt: string | null;
  totalTimeSeconds: number | null;
}

export interface PenaltyAppliedScore {
  rawScore: number;
  penaltyScore: number;
  finalScore: number;
}

export interface NormalizedScoringAnswer {
  problemType: ProblemType;
  normalizedText: string;
  normalizedTrueFalse: "true" | "false" | null;
  normalizedNumeric: number | null;
}

function isStringLiteralMember<T extends readonly string[]>(
  allowedValues: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && allowedValues.includes(value as T[number]);
}

export function isScoringMode(value: unknown): value is ScoringMode {
  return isStringLiteralMember(SCORING_MODES, value);
}

export function isPenaltyMode(value: unknown): value is PenaltyMode {
  return isStringLiteralMember(PENALTY_MODES, value);
}

export function isTieBreaker(value: unknown): value is TieBreaker {
  return isStringLiteralMember(TIE_BREAKERS, value);
}

export function isAttemptGradingMode(value: unknown): value is AttemptGradingMode {
  return isStringLiteralMember(ATTEMPT_GRADING_MODES, value);
}
