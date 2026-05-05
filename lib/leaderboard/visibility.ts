import type { CompetitionRecord } from "@/lib/competition/types";
import type { LeaderboardVisibilityReason } from "@/lib/leaderboard/types";

const DISCOVERABLE_COMPETITION_STATUSES = new Set<CompetitionRecord["status"]>([
  "published",
  "live",
  "paused",
  "ended",
  "archived",
]);

export function isCompetitionVisibleForLeaderboard(competition: CompetitionRecord | null): boolean {
  if (!competition || competition.isDeleted) {
    return false;
  }

  return DISCOVERABLE_COMPETITION_STATUSES.has(competition.status);
}

export function canParticipantViewLeaderboard(input: {
  competition: CompetitionRecord | null;
  hasParticipantContext: boolean;
}): { canView: boolean; reason: LeaderboardVisibilityReason | null } {
  const { competition, hasParticipantContext } = input;

  if (!competition) {
    return {
      canView: false,
      reason: "competition_not_found",
    };
  }

  if (!isCompetitionVisibleForLeaderboard(competition)) {
    return {
      canView: false,
      reason: "competition_hidden",
    };
  }

  if (!hasParticipantContext) {
    return {
      canView: false,
      reason: "participant_context_required",
    };
  }

  if (competition.type === "scheduled" && !competition.leaderboardPublished) {
    return {
      canView: false,
      reason: "scheduled_unpublished",
    };
  }

  return {
    canView: true,
    reason: null,
  };
}
