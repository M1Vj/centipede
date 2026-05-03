import { normalizeProblemRow } from "@/lib/problem-bank/api-helpers";
import type { ProblemRecord } from "@/lib/problem-bank/api-helpers";
import type { OffensePenaltyRule } from "@/lib/scoring/types";
import { SAFE_EXAM_BROWSER_MODES, type SafeExamBrowserMode } from "@/lib/scoring/types";
import {
  normalizeAttemptGradingModeToken,
  normalizePenaltyModeToken,
  normalizeScoringModeToken,
  normalizeTieBreakerToken,
} from "@/lib/scoring/validation";
import {
  type CompetitionBankRecord,
  type CompetitionDraftFormState,
  type CompetitionDraftMutationPayload,
  type CompetitionLifecycleResult,
  type CompetitionProblemPreview,
  type CompetitionRegistrationTimingMode,
  type CompetitionRecord,
  type CompetitionStatus,
} from "./types";

export const COMPETITION_SELECT_COLUMNS =
  "id, organizer_id, name, description, instructions, type, format, status, answer_key_visibility, registration_start, registration_end, start_time, end_time, duration_minutes, attempts_allowed, multi_attempt_grading_mode, max_participants, participants_per_team, max_teams, scoring_mode, custom_points, penalty_mode, deduction_value, tie_breaker, shuffle_questions, shuffle_options, log_tab_switch, offense_penalties, safe_exam_browser_mode, safe_exam_browser_config_key_hashes, scoring_snapshot_json, draft_revision, draft_version, is_deleted, published, is_paused, published_at, created_at, updated_at";

export const LEGACY_COMPETITION_SELECT_COLUMNS =
  "id, organizer_id, name, description, instructions, type, format, registration_start, registration_end, start_time, duration_minutes, attempts_allowed, max_participants, participants_per_team, max_teams, scoring_mode, custom_points, penalty_mode, deduction_value, tie_breaker, shuffle_questions, shuffle_options, log_tab_switch, offense_penalties, published, is_paused, created_at";

export const COMPETITION_BANK_SELECT_COLUMNS =
  "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at";

export function isLegacyCompetitionSelectError(
  error: { code?: string | null; message?: string | null; details?: string | null } | null | undefined,
) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("column competitions.status does not exist") ||
    message.includes("column competitions.answer_key_visibility does not exist") ||
    message.includes("column competitions.end_time does not exist") ||
    message.includes("column competitions.multi_attempt_grading_mode does not exist") ||
    message.includes("column competitions.scoring_snapshot_json does not exist") ||
    message.includes("column competitions.safe_exam_browser_mode does not exist") ||
    message.includes("column competitions.safe_exam_browser_config_key_hashes does not exist") ||
    message.includes("column competitions.draft_revision does not exist") ||
    message.includes("column competitions.draft_version does not exist") ||
    message.includes("column competitions.is_deleted does not exist") ||
    message.includes("column competitions.published_at does not exist")
  );
}

function toLegacyScoringMode(value: CompetitionDraftMutationPayload["scoringMode"]) {
  return value === "custom" ? "custom" : "automatic";
}

function toLegacyPenaltyMode(value: CompetitionDraftMutationPayload["penaltyMode"]) {
  return value === "fixed_deduction" ? "deduction" : "none";
}

function toLegacyTieBreaker(value: CompetitionDraftMutationPayload["tieBreaker"]) {
  return value === "lowest_total_time" ? "average_time" : "earliest_submission";
}

export function buildOffensePenaltiesJson(input: CompetitionDraftMutationPayload["offensePenalties"]) {
  const payload: Record<string, number> = {};

  for (const rule of [...input].sort((left, right) => left.threshold - right.threshold)) {
    if (rule.penaltyKind === "warning" && payload.warning_threshold === undefined) {
      payload.warning_threshold = rule.threshold;
    }

    if (rule.penaltyKind === "deduction" && payload.deduction_threshold === undefined) {
      payload.deduction_threshold = rule.threshold;
      payload.deduction_value = rule.deductionValue;
    }

    if (rule.penaltyKind === "forced_submit" && payload.auto_submit_threshold === undefined) {
      payload.auto_submit_threshold = rule.threshold;
    }

    if (rule.penaltyKind === "disqualification" && payload.disqualification_threshold === undefined) {
      payload.disqualification_threshold = rule.threshold;
    }
  }

  return payload;
}

export function buildCompetitionDraftRpcPayload(input: CompetitionDraftMutationPayload) {
  return {
    ...input,
    customPoints: input.customPointsByProblemId,
    scoringMode: toLegacyScoringMode(input.scoringMode),
    penaltyMode: toLegacyPenaltyMode(input.penaltyMode),
    tieBreaker: toLegacyTieBreaker(input.tieBreaker),
  } as const;
}

export function buildLegacyCompetitionMutationPayload(input: CompetitionDraftMutationPayload) {
  return {
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    type: input.type,
    format: input.format,
    registration_start: input.registrationStart,
    registration_end: input.registrationEnd,
    start_time: input.startTime,
    duration_minutes: input.durationMinutes,
    attempts_allowed: input.attemptsAllowed,
    max_participants: input.maxParticipants,
    participants_per_team: input.participantsPerTeam,
    max_teams: input.maxTeams,
    scoring_mode: toLegacyScoringMode(input.scoringMode),
    custom_points: input.customPointsByProblemId,
    penalty_mode: toLegacyPenaltyMode(input.penaltyMode),
    deduction_value: input.deductionValue,
    tie_breaker: toLegacyTieBreaker(input.tieBreaker),
    shuffle_questions: input.shuffleQuestions,
    shuffle_options: input.shuffleOptions,
    log_tab_switch: input.logTabSwitch,
    offense_penalties: input.offensePenalties,
    offense_penalties_json: buildOffensePenaltiesJson(input.offensePenalties),
    safe_exam_browser_mode: input.safeExamBrowserMode,
    safe_exam_browser_config_key_hashes: input.safeExamBrowserConfigKeyHashes,
    published: false,
    is_paused: false,
  } as const;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asLifecycleRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    return {
      machine_code: value,
    };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }

    const first = value[0];
    const firstRecord = asRecord(first);
    if (firstRecord) {
      return firstRecord;
    }

    if (typeof first === "string") {
      return {
        machine_code: first,
      };
    }

    return null;
  }

  const record = asRecord(value);
  if (!record) {
    return null;
  }

  if (typeof record.machine_code === "string" || typeof record.machineCode === "string") {
    return record;
  }

  const wrappedKeys = [
    "publish_competition",
    "start_competition",
    "end_competition",
    "archive_competition",
    "save_competition_draft",
    "delete_draft_competition",
    "result",
    "data",
  ] as const;

  for (const key of wrappedKeys) {
    const wrappedRecord = asRecord(record[key]);
    if (wrappedRecord) {
      return wrappedRecord;
    }

    if (typeof record[key] === "string") {
      return {
        machine_code: record[key],
      };
    }
  }

  return record;
}

function hasExplicitLifecycleMachineCode(record: Record<string, unknown>): boolean {
  return typeof record.machine_code === "string" || typeof record.machineCode === "string";
}

function normalizeLifecycleFiniteInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function normalizeLifecycleBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "t" || normalized === "1") {
      return true;
    }

    if (normalized === "false" || normalized === "f" || normalized === "0") {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return false;
}

function normalizeLifecycleStatus(value: unknown): CompetitionStatus | null {
  if (
    value === "draft" ||
    value === "published" ||
    value === "live" ||
    value === "paused" ||
    value === "ended" ||
    value === "archived"
  ) {
    return value;
  }

  return null;
}

function normalizeLifecycleString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeDateTimeInput(value: unknown): string {
  if (typeof value !== "string" || !value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(
    parsed.getHours(),
  )}:${pad(parsed.getMinutes())}`;
}

function areDateTimeStringsSameInstant(left: string | null, right: string | null): boolean {
  if (!left || !right) {
    return left === right;
  }

  const leftMs = new Date(left).getTime();
  const rightMs = new Date(right).getTime();

  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return left === right;
  }

  return leftMs === rightMs;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function normalizeRecordMap(value: unknown): Record<string, number> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = Math.trunc(entry);
      return;
    }

    if (typeof entry === "string" && entry.trim()) {
      const parsed = Number.parseInt(entry.trim(), 10);
      if (Number.isFinite(parsed)) {
        result[key] = Math.trunc(parsed);
      }
    }
  });

  return result;
}

function normalizeOffensePenalties(value: unknown): OffensePenaltyRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const record = asRecord(entry);
      if (!record) {
        return null;
      }

      const threshold =
        typeof record.threshold === "number" && Number.isFinite(record.threshold)
          ? Math.trunc(record.threshold)
          : null;
      const penaltyKind =
        typeof record.penaltyKind === "string" ? record.penaltyKind : null;
      const deductionValue =
        typeof record.deductionValue === "number" && Number.isFinite(record.deductionValue)
          ? Math.trunc(record.deductionValue)
          : 0;

      if (threshold === null || !penaltyKind) {
        return null;
      }

      return {
        threshold,
        penaltyKind: penaltyKind as OffensePenaltyRule["penaltyKind"],
        deductionValue,
      };
    })
    .filter((entry): entry is OffensePenaltyRule => entry !== null);
}

function normalizeSafeExamBrowserMode(value: unknown): SafeExamBrowserMode {
  return SAFE_EXAM_BROWSER_MODES.includes(value as SafeExamBrowserMode)
    ? (value as SafeExamBrowserMode)
    : "off";
}

function normalizeSafeExamBrowserHashes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, entries) => /^[a-f0-9]{64}$/.test(entry) && entries.indexOf(entry) === index);
}

export function normalizeCompetitionRecord(row: unknown): CompetitionRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = normalizeString(record.id);
  const organizerId = normalizeString(record.organizer_id);
  const createdAt = normalizeString(record.created_at);
  const updatedAt = normalizeString(record.updated_at) || createdAt;

  if (!id || !organizerId || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    organizerId,
    name: normalizeString(record.name),
    description: normalizeString(record.description),
    instructions: normalizeString(record.instructions),
    type: record.type === "open" ? "open" : "scheduled",
    format: record.format === "team" ? "team" : "individual",
    status:
      record.status === "published" ||
      record.status === "live" ||
      record.status === "paused" ||
      record.status === "ended" ||
      record.status === "archived"
        ? (record.status as CompetitionStatus)
        : Boolean(record.is_paused)
          ? "paused"
          : Boolean(record.published)
            ? "published"
            : "draft",
    answerKeyVisibility: record.answer_key_visibility === "hidden" ? "hidden" : "after_end",
    registrationStart: normalizeString(record.registration_start) || null,
    registrationEnd: normalizeString(record.registration_end) || null,
    startTime: normalizeString(record.start_time) || null,
    endTime: normalizeString(record.end_time) || null,
    durationMinutes:
      typeof record.duration_minutes === "number" && Number.isFinite(record.duration_minutes)
        ? Math.trunc(record.duration_minutes)
        : 0,
    attemptsAllowed:
      typeof record.attempts_allowed === "number" && Number.isFinite(record.attempts_allowed)
        ? Math.trunc(record.attempts_allowed)
        : 1,
    multiAttemptGradingMode:
      normalizeAttemptGradingModeToken(record.multi_attempt_grading_mode) ?? "highest_score",
    maxParticipants:
      typeof record.max_participants === "number" && Number.isFinite(record.max_participants)
        ? Math.trunc(record.max_participants)
        : null,
    participantsPerTeam:
      typeof record.participants_per_team === "number" && Number.isFinite(record.participants_per_team)
        ? Math.trunc(record.participants_per_team)
        : null,
    maxTeams:
      typeof record.max_teams === "number" && Number.isFinite(record.max_teams)
        ? Math.trunc(record.max_teams)
        : null,
    scoringMode: normalizeScoringModeToken(record.scoring_mode) ?? "difficulty",
    customPointsByProblemId: normalizeRecordMap(record.custom_points),
    penaltyMode: normalizePenaltyModeToken(record.penalty_mode) ?? "none",
    deductionValue:
      typeof record.deduction_value === "number" && Number.isFinite(record.deduction_value)
        ? Math.trunc(record.deduction_value)
        : 0,
    tieBreaker: normalizeTieBreakerToken(record.tie_breaker) ?? "earliest_final_submission",
    shuffleQuestions: Boolean(record.shuffle_questions),
    shuffleOptions: Boolean(record.shuffle_options),
    logTabSwitch: Boolean(record.log_tab_switch),
    offensePenalties: normalizeOffensePenalties(record.offense_penalties),
    safeExamBrowserMode: normalizeSafeExamBrowserMode(record.safe_exam_browser_mode),
    safeExamBrowserConfigKeyHashes: normalizeSafeExamBrowserHashes(record.safe_exam_browser_config_key_hashes),
    scoringSnapshotJson:
      typeof record.scoring_snapshot_json === "object" && record.scoring_snapshot_json !== null
        ? (record.scoring_snapshot_json as Record<string, unknown>)
        : null,
    draftRevision:
      typeof record.draft_revision === "number" && Number.isFinite(record.draft_revision)
        ? Math.trunc(record.draft_revision)
        : 1,
    draftVersion:
      typeof record.draft_version === "number" && Number.isFinite(record.draft_version)
        ? Math.trunc(record.draft_version)
        : 1,
    isDeleted: Boolean(record.is_deleted),
    publishedAt: normalizeString(record.published_at) || null,
    createdAt,
    updatedAt,
  };
}

export function competitionRecordToFormState(
  competition: CompetitionRecord,
  selectedProblemIds: string[] = [],
): CompetitionDraftFormState {
  const registrationEndDiffersFromStart =
    Boolean(competition.registrationEnd) &&
    (!competition.startTime ||
      !areDateTimeStringsSameInstant(competition.registrationEnd, competition.startTime));

  const registrationTimingMode: CompetitionRegistrationTimingMode =
    competition.type !== "scheduled"
      ? "default"
      : competition.registrationStart || registrationEndDiffersFromStart
        ? "manual"
        : "default";

  return {
    name: competition.name,
    description: competition.description,
    instructions: competition.instructions,
    type: competition.type,
    format: competition.format,
    registrationTimingMode,
    registrationStart: normalizeDateTimeInput(competition.registrationStart),
    registrationEnd: normalizeDateTimeInput(competition.registrationEnd),
    startTime: normalizeDateTimeInput(competition.startTime),
    endTime: normalizeDateTimeInput(competition.endTime),
    durationMinutes: competition.durationMinutes,
    attemptsAllowed: competition.attemptsAllowed,
    multiAttemptGradingMode: competition.multiAttemptGradingMode,
    maxParticipants: competition.maxParticipants,
    participantsPerTeam: competition.participantsPerTeam,
    maxTeams: competition.maxTeams,
    scoringMode: competition.scoringMode,
    customPointsByProblemId: competition.customPointsByProblemId,
    penaltyMode: competition.penaltyMode,
    deductionValue: competition.deductionValue,
    tieBreaker: competition.tieBreaker,
    shuffleQuestions: competition.shuffleQuestions,
    shuffleOptions: competition.shuffleOptions,
    logTabSwitch: competition.logTabSwitch,
    offensePenalties: competition.offensePenalties,
    safeExamBrowserMode: competition.safeExamBrowserMode,
    safeExamBrowserConfigKeyHashes: competition.safeExamBrowserConfigKeyHashes,
    answerKeyVisibility: competition.answerKeyVisibility,
    selectedProblemIds,
  };
}

export function normalizeCompetitionBankRecord(row: unknown): CompetitionBankRecord | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const id = normalizeString(record.id);
  const organizerId = normalizeString(record.organizer_id);
  const createdAt = normalizeString(record.created_at);
  const updatedAt = normalizeString(record.updated_at) || createdAt;

  if (!id || !organizerId || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    organizerId,
    name: normalizeString(record.name),
    description: normalizeString(record.description),
    isDefaultBank: Boolean(record.is_default_bank),
    isVisibleToOrganizers: Boolean(record.is_visible_to_organizers),
    isDeleted: Boolean(record.is_deleted),
    createdAt,
    updatedAt,
  };
}

export function normalizeCompetitionLifecycleResult(row: unknown): CompetitionLifecycleResult | null {
  const record = asLifecycleRecord(row);
  if (!record) {
    return null;
  }

  if (!hasExplicitLifecycleMachineCode(record)) {
    return null;
  }

  const draftRevision =
    normalizeLifecycleFiniteInt(record.draft_revision) ??
    normalizeLifecycleFiniteInt(record.draftRevision) ??
    normalizeLifecycleFiniteInt(record.current_draft_revision) ??
    normalizeLifecycleFiniteInt(record.currentDraftRevision);
  const draftVersion =
    normalizeLifecycleFiniteInt(record.draft_version) ?? normalizeLifecycleFiniteInt(record.draftVersion);
  const selectedProblemCount =
    normalizeLifecycleFiniteInt(record.selected_problem_count) ??
    normalizeLifecycleFiniteInt(record.selectedProblemCount);
  const status =
    normalizeLifecycleStatus(record.status) ??
    normalizeLifecycleStatus(record.current_status) ??
    normalizeLifecycleStatus(record.currentStatus);
  const machineCode =
    normalizeLifecycleString(record.machine_code) ??
    normalizeLifecycleString(record.machineCode) ??
    "operation_failed";

  return {
    machineCode,
    competitionId:
      normalizeLifecycleString(record.competition_id) ??
      normalizeLifecycleString(record.competitionId) ??
      null,
    status,
    eventId:
      normalizeLifecycleString(record.event_id) ?? normalizeLifecycleString(record.eventId) ?? null,
    requestIdempotencyToken:
      normalizeLifecycleString(record.request_idempotency_token) ??
      normalizeLifecycleString(record.requestIdempotencyToken) ??
      "",
    replayed: normalizeLifecycleBoolean(record.replayed),
    changed: normalizeLifecycleBoolean(record.changed),
    draftRevision,
    draftVersion,
    selectedProblemCount,
    updatedAt:
      normalizeLifecycleString(record.updated_at) ?? normalizeLifecycleString(record.updatedAt) ?? null,
    currentStatus: status,
    currentDraftRevision: draftRevision,
  };
}

export function normalizeCompetitionProblemPreview(row: unknown): CompetitionProblemPreview | null {
  const record = asRecord(row);
  if (!record) {
    return null;
  }

  const competitionProblemId = normalizeString(record.id);
  const competitionId = normalizeString(record.competition_id);
  const problemId = normalizeString(record.problem_id);
  const problem = normalizeProblemRow(record.problems ?? null) as ProblemRecord | null;

  if (!competitionProblemId || !competitionId || !problemId || !problem) {
    return null;
  }

  return {
    competitionProblemId,
    competitionId,
    problemId,
    orderIndex:
      typeof record.order_index === "number" && Number.isFinite(record.order_index)
        ? Math.trunc(record.order_index)
        : null,
    points:
      typeof record.points === "number" && Number.isFinite(record.points)
        ? Math.trunc(record.points)
        : null,
    contentSnapshotLatex: normalizeString(record.content_snapshot_latex) || null,
    optionsSnapshotJson: record.options_snapshot_json ?? null,
    answerKeySnapshotJson: record.answer_key_snapshot_json ?? null,
    explanationSnapshotLatex: normalizeString(record.explanation_snapshot_latex) || null,
    difficultySnapshot: normalizeString(record.difficulty_snapshot) || null,
    tagsSnapshot: normalizeStringArray(record.tags_snapshot),
    imageSnapshotPath: normalizeString(record.image_snapshot_path) || null,
    problem: {
      id: problem.id,
      type: problem.type,
      difficulty: problem.difficulty,
      contentLatex: problem.contentLatex,
      explanationLatex: problem.explanationLatex,
      tags: problem.tags,
      imagePath: problem.imagePath,
      updatedAt: problem.updatedAt,
      bankId: problem.bankId,
      bankName:
        typeof record.problem_bank_name === "string" ? record.problem_bank_name : "Unknown bank",
    },
  };
}

export function normalizeCompetitionStatus(value: unknown): CompetitionStatus {
  if (
    value === "draft" ||
    value === "published" ||
    value === "live" ||
    value === "paused" ||
    value === "ended" ||
    value === "archived"
  ) {
    return value;
  }

  return "draft";
}
