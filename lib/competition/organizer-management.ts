import type { CompetitionRecord, CompetitionStatus } from "@/lib/competition/types";

export const ORGANIZER_MANAGEMENT_COMPETITION_STATUSES = [
  "draft",
  "published",
  "live",
  "paused",
  "ended",
] as const satisfies readonly CompetitionStatus[];

export type OrganizerManagementCompetitionStatus =
  (typeof ORGANIZER_MANAGEMENT_COMPETITION_STATUSES)[number];

export function isOrganizerManagementCompetitionStatus(
  status: CompetitionStatus,
): status is OrganizerManagementCompetitionStatus {
  return ORGANIZER_MANAGEMENT_COMPETITION_STATUSES.includes(
    status as OrganizerManagementCompetitionStatus,
  );
}

export function isOrganizerManagementCompetition(
  competition: CompetitionRecord,
) {
  return !competition.isDeleted && isOrganizerManagementCompetitionStatus(competition.status);
}
