export type AnswerStatusFlag = "blank" | "filled" | "solved" | "reset";
export type AnswerKeyVisibility = "after_end" | "hidden";
export type CompetitionEndStatus = "draft" | "published" | "live" | "paused" | "ended" | "archived";

export type ReviewSummaryInput = {
  competitionProblemIds: string[];
  answers: Array<{
    competitionProblemId: string;
    statusFlag: AnswerStatusFlag;
  }>;
};

export type ReviewSummary = {
  total: number;
  blank: number;
  filled: number;
  solved: number;
  reset: number;
  answered: number;
  missingRowsInferredBlank: number;
};

export function createReviewSummary(input: ReviewSummaryInput): ReviewSummary {
  const problemIds = new Set(input.competitionProblemIds);
  const seenAnswerRows = new Set<string>();
  const counts: Record<AnswerStatusFlag, number> = {
    blank: 0,
    filled: 0,
    solved: 0,
    reset: 0,
  };

  for (const answer of input.answers) {
    if (!problemIds.has(answer.competitionProblemId) || seenAnswerRows.has(answer.competitionProblemId)) {
      continue;
    }

    seenAnswerRows.add(answer.competitionProblemId);
    counts[answer.statusFlag] += 1;
  }

  const missingRowsInferredBlank = Math.max(problemIds.size - seenAnswerRows.size, 0);
  counts.blank += missingRowsInferredBlank;

  return {
    total: problemIds.size,
    blank: counts.blank,
    filled: counts.filled,
    solved: counts.solved,
    reset: counts.reset,
    answered: counts.filled + counts.solved,
    missingRowsInferredBlank,
  };
}

export function canParticipantViewAnswerKey(input: {
  answerKeyVisibility: AnswerKeyVisibility;
  competitionType?: "open" | "scheduled";
  competitionStatus: CompetitionEndStatus;
  hasParticipantContext: boolean;
  hasTrustedEnd: boolean;
  attemptsAllowed?: number;
  latestAttemptNo?: number;
  latestAttemptStatus?: "in_progress" | "submitted" | "auto_submitted" | "disqualified" | "graded" | null;
  scheduledEndReached?: boolean;
}) {
  if (input.answerKeyVisibility !== "after_end" || !input.hasParticipantContext) {
    return false;
  }

  if (input.competitionType === "open") {
    return (
      input.latestAttemptStatus !== "in_progress" &&
      (input.latestAttemptNo ?? 0) >= Math.max(1, input.attemptsAllowed ?? 1)
    );
  }

  return (
    input.scheduledEndReached === true ||
    (input.hasTrustedEnd && (input.competitionStatus === "ended" || input.competitionStatus === "archived"))
  );
}

export function normalizeDisputeReason(reason: string) {
  const normalized = reason.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 1000);
}
