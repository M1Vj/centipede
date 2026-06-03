import type { CompetitionStatus } from "@/lib/competition/types";

export type AnswerKeyVisibility = "after_end" | "hidden";

export type AnswerKeyVisibilityReason =
  | "allowed"
  | "hidden"
  | "participant_context_required"
  | "competition_not_ended"
  | "end_time_not_reached"
  | "attempts_remaining"
  | "attempt_in_progress";

type AttemptStatus = "in_progress" | "submitted" | "auto_submitted" | "disqualified" | "graded";

export function canViewAnswerKeySnapshot({
  answerKeyVisibility,
  competitionStatus,
  competitionType = "scheduled",
  competitionEndTime,
  hasParticipantContext,
  attemptsAllowed = 1,
  latestAttemptNo = 0,
  latestAttemptStatus = null,
  now = new Date(),
}: {
  answerKeyVisibility: AnswerKeyVisibility;
  competitionStatus: CompetitionStatus;
  competitionType?: "open" | "scheduled";
  competitionEndTime: string | null;
  hasParticipantContext: boolean;
  attemptsAllowed?: number;
  latestAttemptNo?: number;
  latestAttemptStatus?: AttemptStatus | null;
  leaderboardPublished?: boolean;
  now?: Date;
}): { allowed: boolean; reason: AnswerKeyVisibilityReason } {
  if (answerKeyVisibility === "hidden") {
    return { allowed: false, reason: "hidden" };
  }

  if (!hasParticipantContext) {
    return { allowed: false, reason: "participant_context_required" };
  }

  if (competitionType === "open") {
    if (latestAttemptStatus === "in_progress") {
      return { allowed: false, reason: "attempt_in_progress" };
    }

    if (latestAttemptNo < Math.max(1, attemptsAllowed)) {
      return { allowed: false, reason: "attempts_remaining" };
    }

    return { allowed: true, reason: "allowed" };
  }

  if (competitionStatus === "draft" || competitionStatus === "published") {
    return { allowed: false, reason: "competition_not_ended" };
  }

  if (competitionStatus === "ended" || competitionStatus === "archived") {
    return { allowed: true, reason: "allowed" };
  }

  if (competitionEndTime) {
    const endTime = new Date(competitionEndTime);
    if (!Number.isNaN(endTime.getTime())) {
      return now.getTime() < endTime.getTime()
        ? { allowed: false, reason: "end_time_not_reached" }
        : { allowed: true, reason: "allowed" };
    }
  }

  return { allowed: false, reason: "competition_not_ended" };
}
