import type { CompetitionStatus } from "@/lib/competition/types";

export type AnswerKeyVisibility = "after_end" | "hidden";

export type AnswerKeyVisibilityReason =
  | "allowed"
  | "hidden"
  | "participant_context_required"
  | "competition_not_ended"
  | "end_time_not_reached";

export function canViewAnswerKeySnapshot({
  answerKeyVisibility,
  competitionStatus,
  competitionEndTime,
  hasParticipantContext,
  now = new Date(),
}: {
  answerKeyVisibility: AnswerKeyVisibility;
  competitionStatus: CompetitionStatus;
  competitionEndTime: string | null;
  hasParticipantContext: boolean;
  leaderboardPublished?: boolean;
  now?: Date;
}): { allowed: boolean; reason: AnswerKeyVisibilityReason } {
  if (answerKeyVisibility === "hidden") {
    return { allowed: false, reason: "hidden" };
  }

  if (!hasParticipantContext) {
    return { allowed: false, reason: "participant_context_required" };
  }

  if (competitionStatus !== "ended" && competitionStatus !== "archived") {
    return { allowed: false, reason: "competition_not_ended" };
  }

  if (competitionEndTime) {
    const endTime = new Date(competitionEndTime);
    if (!Number.isNaN(endTime.getTime()) && now.getTime() < endTime.getTime()) {
      return { allowed: false, reason: "end_time_not_reached" };
    }
  }

  return { allowed: true, reason: "allowed" };
}
