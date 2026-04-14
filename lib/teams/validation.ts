import { normalizeWhitespace } from "@/lib/problem-bank/normalization";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_TOKEN_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export const TEAM_CODE_LENGTH = 10;
export const TEAM_CODE_PATTERN = new RegExp(`^[A-Z0-9]{${TEAM_CODE_LENGTH}}$`);

export type TeamValidationError = {
  field: string;
  reason: string;
};

export type TeamValidationResult<T> = {
  ok: boolean;
  value: T | null;
  errors: TeamValidationError[];
};

function ok<T>(value: T): TeamValidationResult<T> {
  return {
    ok: true,
    value,
    errors: [],
  };
}

function fail<T>(errors: TeamValidationError[]): TeamValidationResult<T> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

export function normalizeTeamName(value: string): string {
  return normalizeWhitespace(value);
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function validateTeamNameInput(value: unknown): TeamValidationResult<string> {
  const name = normalizeTeamName(typeof value === "string" ? value : "");
  const errors: TeamValidationError[] = [];

  if (!name) {
    errors.push({
      field: "name",
      reason: "Team name is required.",
    });
  }

  if (name.length > 80) {
    errors.push({
      field: "name",
      reason: "Team name must be 80 characters or fewer.",
    });
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok(name);
}

export function validateIdempotencyToken(
  value: unknown,
  field = "requestIdempotencyToken",
): TeamValidationResult<string> {
  const token = typeof value === "string" ? value.trim() : "";
  const errors: TeamValidationError[] = [];

  if (!token) {
    errors.push({
      field,
      reason: `${field} is required.`,
    });
  } else if (!IDEMPOTENCY_TOKEN_PATTERN.test(token)) {
    errors.push({
      field,
      reason: `${field} must be 8-128 characters using letters, numbers, '.', '_', ':', or '-'.`,
    });
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok(token);
}

export function validateTeamCodeInput(value: unknown): TeamValidationResult<string> {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";

  if (!code || !TEAM_CODE_PATTERN.test(code)) {
    return fail([
      {
        field: "teamCode",
        reason: `Team code must be ${TEAM_CODE_LENGTH} characters using letters and numbers only.`,
      },
    ]);
  }

  return ok(code);
}

export function validateInviteAction(value: unknown): TeamValidationResult<
  "accept" | "decline"
> {
  if (value !== "accept" && value !== "decline") {
    return fail([
      {
        field: "action",
        reason: "Action must be either 'accept' or 'decline'.",
      },
    ]);
  }

  return ok(value);
}
