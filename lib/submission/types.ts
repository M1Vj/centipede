import type { AnswerStatusFlag, AttemptStatus } from "@/lib/arena/types";
import type { ProblemType } from "@/lib/problem-bank/types";
import type { CompetitionStatus } from "@/lib/competition/types";
import type { CompetitionType } from "@/lib/scoring/types";

export type AttemptGradingMode = "highest_score" | "latest_score" | "average_score";
export type AnswerKeyVisibility = "after_end" | "hidden";

export type ReviewSubmissionCompetition = {
  id: string;
  name: string;
  type: CompetitionType;
  status: CompetitionStatus;
  attemptsAllowed: number;
  multiAttemptGradingMode: AttemptGradingMode;
};

export type ReviewSubmissionAttempt = {
  id: string;
  attemptNo: number;
  status: AttemptStatus;
  submittedAt: string | null;
  finalScore: number | null;
  rawScore: number | null;
  penaltyScore: number | null;
  gradedAt: string | null;
};

export type ReviewSubmissionProblem = {
  competitionProblemId: string;
  orderIndex: number;
  points: number | null;
  type: ProblemType;
  contentLatex: string;
  answerLatex: string;
  answerTextNormalized: string;
  statusFlag: AnswerStatusFlag;
};

export type ReviewSummaryCounts = Record<AnswerStatusFlag, number> & {
  total: number;
};

export type ReviewSubmissionPageData = {
  competition: ReviewSubmissionCompetition;
  attempt: ReviewSubmissionAttempt;
  attemptsRemaining: number;
  summaryCounts: ReviewSummaryCounts;
  problems: ReviewSubmissionProblem[];
};

export type AnswerKeyProblem = {
  competitionProblemId: string;
  orderIndex: number;
  points: number | null;
  type: ProblemType;
  contentLatex: string;
  explanationLatex: string;
  answerKeyLatex: string[];
  isCorrect: boolean | null;
  pointsAwarded: number | null;
  existingDisputeStatus: string | null;
  existingDisputeResolutionNote: string | null;
};

export type AnswerKeyPageData = {
  competition: {
    id: string;
    name: string;
    answerKeyVisibility: AnswerKeyVisibility;
    status: CompetitionStatus;
  };
  attempt: {
    id: string;
    attemptNo: number;
    finalScore: number | null;
  } | null;
  canViewAnswerKey: boolean;
  canDispute: boolean;
  problems: AnswerKeyProblem[];
};
