import type { CompetitionFormat, CompetitionStatus } from "@/lib/competition/types";
import type { ProblemType } from "@/lib/problem-bank/types";
import type { CompetitionType } from "@/lib/scoring/types";
import type { SafeExamBrowserMode } from "@/lib/scoring/types";

export const ARENA_PAGE_MODES = ["detail_register", "pre_entry", "arena_runtime"] as const;
export type ArenaPageMode = (typeof ARENA_PAGE_MODES)[number];

export const ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
  "auto_submitted",
  "disqualified",
  "graded",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ANSWER_STATUS_FLAGS = ["blank", "filled", "solved", "reset"] as const;
export type AnswerStatusFlag = (typeof ANSWER_STATUS_FLAGS)[number];

export interface ArenaCompetitionSummary {
  id: string;
  name: string;
  description: string;
  instructions: string;
  type: CompetitionType;
  format: CompetitionFormat;
  status: CompetitionStatus;
  registrationStart: string | null;
  registrationEnd: string | null;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number;
  attemptsAllowed: number;
  participantsPerTeam: number | null;
  logTabSwitch: boolean;
  safeExamBrowserMode: SafeExamBrowserMode;
}

export interface ArenaRegistrationSummary {
  id: string;
  competitionId: string;
  profileId: string | null;
  teamId: string | null;
  status: "registered" | "withdrawn" | "ineligible" | "cancelled";
  statusReason: string | null;
  registeredAt: string;
  updatedAt: string;
  actorIsLeader: boolean;
  actorCanStart: boolean;
  actorCanWrite: boolean;
  teamName: string | null;
}

export interface ArenaAttemptAnswer {
  id: string;
  attemptId: string;
  competitionProblemId: string;
  answerLatex: string;
  answerTextNormalized: string;
  statusFlag: AnswerStatusFlag;
  lastSavedAt: string;
  clientUpdatedAt: string;
}

export interface ArenaProblemOption {
  id: string;
  label: string;
}

export interface ArenaProblem {
  competitionProblemId: string;
  competitionId: string;
  problemId: string;
  orderIndex: number;
  points: number | null;
  type: ProblemType;
  contentLatex: string;
  explanationLatex: string;
  options: ArenaProblemOption[];
  imagePath: string | null;
  tags: string[];
  difficulty: string | null;
}

export interface ArenaAttemptSummary {
  id: string;
  competitionId: string;
  registrationId: string;
  attemptNo: number;
  status: AttemptStatus;
  startedAt: string;
  submittedAt: string | null;
  totalTimeSeconds: number;
  remainingSeconds: number;
  effectiveAttemptDeadlineAt: string | null;
  attemptBaseDeadlineAt: string | null;
  scheduledCompetitionEndCapAt: string | null;
  answers: ArenaAttemptAnswer[];
}

export interface EligibleTeamSummary {
  id: string;
  name: string;
  role: string;
}

export interface ArenaPageData {
  mode: ArenaPageMode;
  competition: ArenaCompetitionSummary;
  registration: ArenaRegistrationSummary | null;
  activeAttempt: ArenaAttemptSummary | null;
  latestAttempt: ArenaAttemptSummary | null;
  problems: ArenaProblem[];
  eligibleTeams: EligibleTeamSummary[];
  attemptsRemaining: number;
  canRegister: boolean;
  canResume: boolean;
  nowIso: string;
}

export interface ArenaCompetitionListItem {
  competition: ArenaCompetitionSummary;
  registration: ArenaRegistrationSummary | null;
  mode: ArenaPageMode;
  activeAttemptId: string | null;
}

export interface SaveArenaAnswerInput {
  attemptId: string;
  actorUserId: string;
  competitionProblemId: string;
  problemType: ProblemType;
  rawValue: string;
  statusFlag: AnswerStatusFlag;
  clientUpdatedAt: string;
}
