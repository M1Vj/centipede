export type SafeDatabaseError = {
  code: string;
  message: string;
  status: number;
};

export type TeamRecord = {
  id: string;
  name: string;
  teamCode: string;
  createdBy: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TeamMembershipRecord = {
  id: string;
  teamId: string;
  profileId: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  isActive: boolean;
};

export type TeamInvitationRecord = {
  id: string;
  teamId: string;
  inviterId: string;
  inviteeId: string;
  status: string;
  createdAt: string;
  respondedAt: string | null;
};

export type TeamMemberProfile = {
  id: string;
  fullName: string | null;
  school: string | null;
  gradeLevel: string | null;
};

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as UnknownRecord;
}

function readString(record: UnknownRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function readNullableString(record: UnknownRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readBoolean(record: UnknownRecord, key: string): boolean {
  return record[key] === true;
}

export function normalizeTeamRow(row: unknown): TeamRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  const name = readString(record, "name");
  const teamCode = readString(record, "team_code");
  const createdBy = readString(record, "created_by");
  const createdAt = readString(record, "created_at");
  const updatedAt = readString(record, "updated_at");

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    teamCode,
    createdBy,
    isArchived: readBoolean(record, "is_archived"),
    createdAt,
    updatedAt,
  };
}

export function normalizeTeamMembershipRow(row: unknown): TeamMembershipRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  const teamId = readString(record, "team_id");
  const profileId = readString(record, "profile_id");
  const role = readString(record, "role");
  const joinedAt = readString(record, "joined_at");

  if (!id || !teamId || !profileId) {
    return null;
  }

  return {
    id,
    teamId,
    profileId,
    role,
    joinedAt,
    leftAt: readNullableString(record, "left_at"),
    isActive: record["is_active"] !== false,
  };
}

export function normalizeTeamInvitationRow(row: unknown): TeamInvitationRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  const teamId = readString(record, "team_id");
  const inviterId = readString(record, "inviter_id");
  const inviteeId = readString(record, "invitee_id");
  const status = readString(record, "status");
  const createdAt = readString(record, "created_at");

  if (!id || !teamId || !inviterId || !inviteeId) {
    return null;
  }

  return {
    id,
    teamId,
    inviterId,
    inviteeId,
    status,
    createdAt,
    respondedAt: readNullableString(record, "responded_at"),
  };
}

export function normalizeTeamMemberProfile(row: unknown): TeamMemberProfile | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = readString(record, "id");
  if (!id) {
    return null;
  }

  return {
    id,
    fullName: readNullableString(record, "full_name"),
    school: readNullableString(record, "school"),
    gradeLevel: readNullableString(record, "grade_level"),
  };
}

export function mapTeamDatabaseError(error: unknown): SafeDatabaseError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? ((error as { code: string }).code ?? "")
      : "";

  switch (code) {
    case "23505":
      return {
        code: "duplicate_resource",
        message: "Resource already exists.",
        status: 409,
      };
    case "23503":
      return {
        code: "invalid_reference",
        message: "Referenced resource is invalid.",
        status: 400,
      };
    case "23514":
      return {
        code: "constraint_failed",
        message: "Request failed validation checks.",
        status: 400,
      };
    case "22P02":
      return {
        code: "invalid_input",
        message: "Request payload is invalid.",
        status: 400,
      };
    case "42501":
      return {
        code: "forbidden",
        message: "You do not have permission for this operation.",
        status: 403,
      };
    default:
      return {
        code: "operation_failed",
        message: "Operation could not be completed.",
        status: 500,
      };
  }
}
