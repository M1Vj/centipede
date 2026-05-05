import type {
  OrganizerRegistrationDetail,
  OrganizerRegistrationRosterMember,
} from "@/lib/registrations/types";

export const ORGANIZER_REGISTRATION_SELECT_COLUMNS =
  "id, competition_id, profile_id, team_id, status, status_reason, entry_snapshot_json, registered_at, updated_at, profiles:profile_id(id, full_name, school, grade_level), teams:team_id(id, name, team_code)";

export const ORGANIZER_REGISTRATION_FALLBACK_SELECT_COLUMNS =
  "id, competition_id, profile_id, team_id, status, status_reason, entry_snapshot_json, registered_at, updated_at";

export type OrganizerRegistrationSourceRow = {
  id?: unknown;
  competition_id?: unknown;
  profile_id?: unknown;
  team_id?: unknown;
  status?: unknown;
  status_reason?: unknown;
  entry_snapshot_json?: unknown;
  registered_at?: unknown;
  updated_at?: unknown;
  profiles?: unknown;
  teams?: unknown;
};

function firstRelatedRow(value: unknown) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value && typeof value === "object" ? value : null;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function normalizeRoster(value: unknown): OrganizerRegistrationRosterMember[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((member) => {
      const row = readRecord(member);
      const fullName = readString(row.full_name) ?? "Unnamed member";

      return {
        profileId: readString(row.profile_id),
        fullName,
        school: readString(row.school),
        gradeLevel: readString(row.grade_level),
        role: readString(row.role),
      };
    })
    .filter((member) => member.fullName.length > 0);
}

export function normalizeOrganizerRegistrationRow(
  row: OrganizerRegistrationSourceRow,
): OrganizerRegistrationDetail | null {
  const id = readString(row.id);
  const competitionId = readString(row.competition_id);
  const status = readString(row.status);

  if (!id || !competitionId || !status) {
    return null;
  }

  if (
    status !== "registered" &&
    status !== "withdrawn" &&
    status !== "ineligible" &&
    status !== "cancelled"
  ) {
    return null;
  }

  const profileId = readString(row.profile_id);
  const teamId = readString(row.team_id);
  const snapshot = readRecord(row.entry_snapshot_json);
  const profile = readRecord(firstRelatedRow(row.profiles));
  const team = readRecord(firstRelatedRow(row.teams));
  const isTeam = Boolean(teamId);
  const roster = normalizeRoster(snapshot.roster);

  const displayName = isTeam
    ? readString(team.name) ?? readString(snapshot.team_name) ?? "Unnamed team"
    : readString(profile.full_name) ?? readString(snapshot.full_name) ?? "Unnamed participant";

  const school = isTeam
    ? readString(snapshot.team_code) ?? readString(team.team_code)
    : readString(profile.school) ?? readString(snapshot.school);
  const gradeLevel = isTeam
    ? roster.length > 0 ? `${roster.length} member${roster.length === 1 ? "" : "s"}` : null
    : readString(profile.grade_level) ?? readString(snapshot.grade_level);

  const subtitle = [school, gradeLevel].filter(Boolean).join(" / ") || null;

  return {
    id,
    competitionId,
    profileId,
    teamId,
    participantType: isTeam ? "team" : "individual",
    displayName,
    subtitle,
    status,
    statusReason: readString(row.status_reason),
    registeredAt: readString(row.registered_at),
    updatedAt: readString(row.updated_at),
    roster,
  };
}
