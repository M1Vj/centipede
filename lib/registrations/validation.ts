import { isUuid, validateIdempotencyToken } from "@/lib/teams/validation";

export type RegistrationValidationError = {
  field: string;
  reason: string;
};

export type RegistrationValidationResult<T> = {
  ok: boolean;
  value: T | null;
  errors: RegistrationValidationError[];
};

function ok<T>(value: T): RegistrationValidationResult<T> {
  return {
    ok: true,
    value,
    errors: [],
  };
}

function fail<T>(errors: RegistrationValidationError[]): RegistrationValidationResult<T> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

export { validateIdempotencyToken };

export function validateCompetitionId(value: unknown): RegistrationValidationResult<string> {
  const competitionId = typeof value === "string" ? value.trim() : "";

  if (!competitionId || !isUuid(competitionId)) {
    return fail([
      {
        field: "competitionId",
        reason: "competitionId must be a valid UUID.",
      },
    ]);
  }

  return ok(competitionId);
}

export function validateRegistrationId(value: unknown): RegistrationValidationResult<string> {
  const registrationId = typeof value === "string" ? value.trim() : "";

  if (!registrationId || !isUuid(registrationId)) {
    return fail([
      {
        field: "registrationId",
        reason: "registrationId must be a valid UUID.",
      },
    ]);
  }

  return ok(registrationId);
}

export function validateTeamId(value: unknown): RegistrationValidationResult<string | null> {
  if (value === null || value === undefined || value === "") {
    return ok(null);
  }

  const teamId = typeof value === "string" ? value.trim() : "";

  if (!teamId || !isUuid(teamId)) {
    return fail([
      {
        field: "teamId",
        reason: "teamId must be a valid UUID.",
      },
    ]);
  }

  return ok(teamId);
}

export function validateStatusReason(value: unknown): RegistrationValidationResult<string> {
  const reason = typeof value === "string" ? value.trim() : "";

  if (!reason) {
    return fail([
      {
        field: "statusReason",
        reason: "statusReason is required.",
      },
    ]);
  }

  if (reason.length > 160) {
    return fail([
      {
        field: "statusReason",
        reason: "statusReason must be 160 characters or fewer.",
      },
    ]);
  }

  return ok(reason);
}
