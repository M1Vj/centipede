import type {
  AttemptGradingMode,
  CompetitionType,
  OffensePenaltyRule,
  PenaltyMode,
  ScoringMode,
  ScoringRuleConfig,
  TieBreaker,
} from "@/lib/scoring/types";
import type { ProblemRecord } from "@/lib/problem-bank/api-helpers";

export const COMPETITION_FORMATS = ["individual", "team"] as const;
export type CompetitionFormat = (typeof COMPETITION_FORMATS)[number];

export const COMPETITION_STATUSES = [
  "draft",
  "published",
  "live",
  "paused",
  "ended",
  "archived",
] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const ANSWER_KEY_VISIBILITY_VALUES = ["after_end", "hidden"] as const;
export type CompetitionAnswerKeyVisibility = (typeof ANSWER_KEY_VISIBILITY_VALUES)[number];

export const REGISTRATION_TIMING_MODES = ["default", "manual"] as const;
export type CompetitionRegistrationTimingMode = (typeof REGISTRATION_TIMING_MODES)[number];

export const COMPETITION_WIZARD_STEPS = [
  "overview",
  "schedule",
  "format",
  "problems",
  "scoring",
  "review",
] as const;
export type CompetitionWizardStep = (typeof COMPETITION_WIZARD_STEPS)[number];

export interface CompetitionValidationError {
  field: string;
  reason: string;
}

export interface CompetitionValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: CompetitionValidationError[];
}

export interface CompetitionDraftFormState {
  name: string;
  description: string;
  instructions: string;
  type: CompetitionType;
  format: CompetitionFormat;
  registrationTimingMode: CompetitionRegistrationTimingMode;
  registrationStart: string;
  registrationEnd: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  attemptsAllowed: number;
  multiAttemptGradingMode: AttemptGradingMode;
  maxParticipants: number | null;
  participantsPerTeam: number | null;
  maxTeams: number | null;
  scoringMode: ScoringMode;
  customPointsByProblemId: Record<string, number>;
  penaltyMode: PenaltyMode;
  deductionValue: number;
  tieBreaker: TieBreaker;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  logTabSwitch: boolean;
  offensePenalties: OffensePenaltyRule[];
  answerKeyVisibility: CompetitionAnswerKeyVisibility;
  selectedProblemIds: string[];
}

export type CompetitionDraftInput = Partial<CompetitionDraftFormState>;

export interface CompetitionDraftMutationPayload {
  name: string;
  description: string;
  instructions: string;
  type: CompetitionType;
  format: CompetitionFormat;
  registrationTimingMode: CompetitionRegistrationTimingMode;
  registrationStart: string | null;
  registrationEnd: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  attemptsAllowed: number;
  multiAttemptGradingMode: AttemptGradingMode;
  maxParticipants: number | null;
  participantsPerTeam: number | null;
  maxTeams: number | null;
  scoringMode: ScoringMode;
  customPointsByProblemId: Record<string, number>;
  penaltyMode: PenaltyMode;
  deductionValue: number;
  tieBreaker: TieBreaker;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  logTabSwitch: boolean;
  offensePenalties: OffensePenaltyRule[];
  answerKeyVisibility: CompetitionAnswerKeyVisibility;
  selectedProblemIds: string[];
}

export interface CompetitionRecord {
  id: string;
  organizerId: string;
  name: string;
  description: string;
  instructions: string;
  type: CompetitionType;
  format: CompetitionFormat;
  status: CompetitionStatus;
  answerKeyVisibility: CompetitionAnswerKeyVisibility;
  registrationStart: string | null;
  registrationEnd: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  attemptsAllowed: number;
  multiAttemptGradingMode: AttemptGradingMode;
  maxParticipants: number | null;
  participantsPerTeam: number | null;
  maxTeams: number | null;
  scoringMode: ScoringMode;
  customPointsByProblemId: Record<string, number>;
  penaltyMode: PenaltyMode;
  deductionValue: number;
  tieBreaker: TieBreaker;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  logTabSwitch: boolean;
  offensePenalties: OffensePenaltyRule[];
  scoringSnapshotJson: Record<string, unknown> | null;
  draftRevision: number;
  draftVersion: number;
  isDeleted: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionProblemPreview {
  competitionProblemId: string;
  competitionId: string;
  problemId: string;
  orderIndex: number | null;
  points: number | null;
  contentSnapshotLatex: string | null;
  optionsSnapshotJson: unknown;
  answerKeySnapshotJson: unknown;
  explanationSnapshotLatex: string | null;
  difficultySnapshot: string | null;
  tagsSnapshot: string[];
  imageSnapshotPath: string | null;
  problem: {
    id: string;
    type: string;
    difficulty: string;
    contentLatex: string;
    explanationLatex: string;
    tags: string[];
    imagePath: string | null;
    updatedAt: string;
    bankId: string;
    bankName: string;
  };
}

export interface CompetitionBankRecord {
  id: string;
  organizerId: string;
  name: string;
  description: string;
  isDefaultBank: boolean;
  isVisibleToOrganizers: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionProblemOption extends ProblemRecord {
  bankName: string;
}

export interface CompetitionLifecycleResult {
  machineCode: string;
  competitionId: string | null;
  status: CompetitionStatus | null;
  eventId: string | null;
  requestIdempotencyToken: string;
  replayed: boolean;
  changed: boolean;
  draftRevision?: number | null;
  draftVersion?: number | null;
  selectedProblemCount?: number | null;
  updatedAt?: string | null;
  currentStatus?: CompetitionStatus | null;
  currentDraftRevision?: number | null;
}

export type CompetitionScoringConfig = ScoringRuleConfig;