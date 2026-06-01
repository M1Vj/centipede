import type { CompetitionRecord } from "@/lib/competition/types";

export type LeaderboardVisibilityReason =
  | "competition_not_found"
  | "competition_hidden"
  | "participant_context_required"
  | "scheduled_unpublished";

export type LeaderboardEntry = {
  id: string;
  competitionId: string;
  registrationId: string;
  attemptId: string;
  rank: number;
  displayName: string;
  score: number;
  totalTimeSeconds: number;
  publishedVisibility: boolean;
  computedAt: string;
};

export type CompetitionLeaderboardView = {
  competition: CompetitionRecord | null;
  entries: LeaderboardEntry[];
  hasParticipantContext: boolean;
  canView: boolean;
  reason: LeaderboardVisibilityReason | null;
};
