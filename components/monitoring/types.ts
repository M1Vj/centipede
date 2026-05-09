export type MonitoringTab = "participants" | "announcements" | "timeline";

export type MonitoringRiskLevel = "low" | "medium" | "high";

export type MonitoringAttemptSummary = {
  attemptId: string;
  registrationId: string;
  displayName: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  startedAt: string | null;
  lastSeenAt: string | null;
  elapsedSeconds: number | null;
  remainingSeconds: number | null;
  offenseCount: number;
  answeredCount: number | null;
  totalQuestions: number | null;
  progressPercent: number;
  riskLevel: MonitoringRiskLevel;
};

export type MonitoringCompetitionEvent = {
  id: string;
  happenedAt: string;
  eventType: string;
  controlAction: string | null;
  reason: string | null;
  actorName: string | null;
  actorRole: string | null;
  result: string | null;
  metadata: Record<string, unknown>;
};

export type AnnouncementAudience =
  | "registered_only"
  | "registered_and_ineligible"
  | "all_non_cancelled"
  | "operators_only";
