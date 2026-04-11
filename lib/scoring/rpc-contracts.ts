const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_TOKEN_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const STRICT_NUMBER_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

export const SCORING_RPC_NAMES = {
  gradeAttempt: "grade_attempt",
  recalculateCompetitionScores: "recalculate_competition_scores",
  refreshLeaderboardEntries: "refresh_leaderboard_entries",
} as const;

export interface RpcValidationError {
  field: string;
  reason: string;
}

export interface RpcValidationResult<T> {
  ok: boolean;
  value: T | null;
  errors: RpcValidationError[];
}

export interface GradeAttemptRpcParams {
  attemptId: string;
}

export interface RecalculateCompetitionScoresRpcParams {
  competitionId: string;
  requestIdempotencyToken: string;
}

export interface RefreshLeaderboardEntriesRpcParams {
  competitionId: string;
}

export interface GradeAttemptRpcRow {
  attemptId: string;
  competitionId: string | null;
  machineCode: string;
  rawScore: number;
  penaltyScore: number;
  finalScore: number;
  gradedAt: string;
}

export interface RecalculateCompetitionScoresRpcRow {
  competitionId: string;
  requestIdempotencyToken: string;
  machineCode: string;
  gradedAttempts: number;
  refreshedRows: number;
  recalculatedAt: string;
}

export interface RefreshLeaderboardEntriesRpcRow {
  competitionId: string;
  machineCode: string;
  refreshedRows: number;
  computedAt: string;
}

function ok<T>(value: T): RpcValidationResult<T> {
  return {
    ok: true,
    value,
    errors: [],
  };
}

function fail<T>(errors: RpcValidationError[]): RpcValidationResult<T> {
  return {
    ok: false,
    value: null,
    errors,
  };
}

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

function isValidIdempotencyToken(value: string): boolean {
  return IDEMPOTENCY_TOKEN_PATTERN.test(value.trim());
}

function normalizeToken(value: string): string {
  return value.trim();
}

export function validateGradeAttemptRpcParams(
  params: GradeAttemptRpcParams,
): RpcValidationResult<GradeAttemptRpcParams> {
  const attemptId = normalizeToken(params.attemptId);
  if (!isUuid(attemptId)) {
    return fail([
      {
        field: "attemptId",
        reason: "attemptId must be a valid UUID.",
      },
    ]);
  }

  return ok({ attemptId });
}

export function validateRecalculateCompetitionScoresRpcParams(
  params: RecalculateCompetitionScoresRpcParams,
): RpcValidationResult<RecalculateCompetitionScoresRpcParams> {
  const competitionId = normalizeToken(params.competitionId);
  const requestIdempotencyToken = normalizeToken(params.requestIdempotencyToken);
  const errors: RpcValidationError[] = [];

  if (!isUuid(competitionId)) {
    errors.push({
      field: "competitionId",
      reason: "competitionId must be a valid UUID.",
    });
  }

  if (!requestIdempotencyToken) {
    errors.push({
      field: "requestIdempotencyToken",
      reason: "requestIdempotencyToken is required.",
    });
  } else if (!isValidIdempotencyToken(requestIdempotencyToken)) {
    errors.push({
      field: "requestIdempotencyToken",
      reason: "requestIdempotencyToken must be 8-128 characters using letters, numbers, '.', '_', ':', or '-'.",
    });
  }

  if (errors.length > 0) {
    return fail(errors);
  }

  return ok({
    competitionId,
    requestIdempotencyToken,
  });
}

export function validateRefreshLeaderboardEntriesRpcParams(
  params: RefreshLeaderboardEntriesRpcParams,
): RpcValidationResult<RefreshLeaderboardEntriesRpcParams> {
  const competitionId = normalizeToken(params.competitionId);
  if (!isUuid(competitionId)) {
    return fail([
      {
        field: "competitionId",
        reason: "competitionId must be a valid UUID.",
      },
    ]);
  }

  return ok({ competitionId });
}

export function toGradeAttemptRpcArgs(params: GradeAttemptRpcParams): {
  p_attempt_id: string;
} {
  return { p_attempt_id: params.attemptId };
}

export function toRecalculateCompetitionScoresRpcArgs(
  params: RecalculateCompetitionScoresRpcParams,
): {
  p_competition_id: string;
  p_request_idempotency_token: string;
} {
  return {
    p_competition_id: params.competitionId,
    p_request_idempotency_token: params.requestIdempotencyToken,
  };
}

export function toRefreshLeaderboardEntriesRpcArgs(
  params: RefreshLeaderboardEntriesRpcParams,
): {
  p_competition_id: string;
} {
  return {
    p_competition_id: params.competitionId,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    if (!trimmedValue || !STRICT_NUMBER_PATTERN.test(trimmedValue)) {
      return null;
    }

    const parsed = Number(trimmedValue);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function parseGradeAttemptRpcRow(row: unknown): GradeAttemptRpcRow | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const attemptId = asString(record.attempt_id).trim();
  if (!isUuid(attemptId)) {
    return null;
  }

  const competitionIdRaw = asString(record.competition_id).trim();
  const competitionId = isUuid(competitionIdRaw) ? competitionIdRaw : null;
  const machineCode = asString(record.machine_code).trim();
  const rawScore = asFiniteNumber(record.raw_score);
  const penaltyScore = asFiniteNumber(record.penalty_score);
  const finalScore = asFiniteNumber(record.final_score);
  const gradedAt = asString(record.graded_at).trim();

  if (!machineCode || rawScore === null || penaltyScore === null || finalScore === null || !gradedAt) {
    return null;
  }

  return {
    attemptId,
    competitionId,
    machineCode,
    rawScore,
    penaltyScore,
    finalScore,
    gradedAt,
  };
}

export function parseRecalculateCompetitionScoresRpcRow(
  row: unknown,
): RecalculateCompetitionScoresRpcRow | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const competitionId = asString(record.competition_id).trim();
  const requestIdempotencyToken = asString(record.request_idempotency_token).trim();
  const machineCode = asString(record.machine_code).trim();
  const gradedAttempts = asFiniteNumber(record.graded_attempts);
  const refreshedRows = asFiniteNumber(record.refreshed_rows);
  const recalculatedAt = asString(record.recalculated_at).trim();

  if (
    !isUuid(competitionId) ||
    !requestIdempotencyToken ||
    !machineCode ||
    gradedAttempts === null ||
    refreshedRows === null ||
    !recalculatedAt
  ) {
    return null;
  }

  return {
    competitionId,
    requestIdempotencyToken,
    machineCode,
    gradedAttempts: Math.max(0, Math.trunc(gradedAttempts)),
    refreshedRows: Math.max(0, Math.trunc(refreshedRows)),
    recalculatedAt,
  };
}

export function parseRefreshLeaderboardEntriesRpcRow(
  row: unknown,
): RefreshLeaderboardEntriesRpcRow | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const competitionId = asString(record.competition_id).trim();
  const machineCode = asString(record.machine_code).trim();
  const refreshedRows = asFiniteNumber(record.refreshed_rows);
  const computedAt = asString(record.computed_at).trim();
  if (!isUuid(competitionId) || !machineCode || refreshedRows === null || !computedAt) {
    return null;
  }

  return {
    competitionId,
    machineCode,
    refreshedRows: Math.max(0, Math.trunc(refreshedRows)),
    computedAt,
  };
}
