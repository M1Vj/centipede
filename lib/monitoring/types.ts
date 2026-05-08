export const MONITORING_ANNOUNCEMENT_AUDIENCES = [
  "registered_only",
  "registered_and_ineligible",
  "all_non_cancelled",
  "operators_only",
] as const;

export type MonitoringAnnouncementAudience = typeof MONITORING_ANNOUNCEMENT_AUDIENCES[number];

export type MonitoringRegistrationStatus = "registered" | "withdrawn" | "ineligible" | "cancelled";

export type MonitoringSummary = {
  competitionId: string;
  participants: MonitoringParticipantSummary[];
  activeAttempts: MonitoringAttemptSummary[];
  timeline: MonitoringTimelineEvent[];
};

export type MonitoringParticipantSummary = {
  registrationId: string;
  profileId: string | null;
  teamId: string | null;
  status: MonitoringRegistrationStatus;
  displayName: string;
};

export type MonitoringAttemptSummary = {
  attemptId: string;
  registrationId: string;
  status: string;
  score: number | null;
  startedAt: string | null;
  lastHeartbeatAt: string | null;
  offenseCount: number;
};

export type MonitoringTimelineEvent = {
  id: string;
  competitionId: string;
  eventType: string;
  controlAction: string | null;
  actorUserId: string | null;
  happenedAt: string | null;
  requestIdempotencyToken: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type MonitoringControlResult = {
  machineCode: string;
  competitionId: string | null;
  status: string | null;
  eventId: string | null;
  replayed: boolean;
  changed: boolean;
  requestIdempotencyToken: string | null;
  decisionOutcome: string | null;
};
