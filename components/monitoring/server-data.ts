import {
  COMPETITION_SELECT_COLUMNS,
  LEGACY_COMPETITION_SELECT_COLUMNS,
  isLegacyCompetitionSelectError,
  normalizeCompetitionRecord,
} from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import { listOrganizerCompetitionRegistrations } from "@/lib/registrations/api";
import type { OrganizerRegistrationDetail } from "@/lib/registrations/types";
import { createClient } from "@/lib/supabase/server";
import type { MonitoringAttemptSummary, MonitoringCompetitionEvent } from "./types";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

type AttemptRow = {
  id?: unknown;
  registration_id?: unknown;
  status?: unknown;
  started_at?: unknown;
  total_time_seconds?: unknown;
  final_score?: unknown;
  raw_score?: unknown;
  offense_count?: unknown;
  effective_attempt_deadline_at?: unknown;
  grade_summary_json?: unknown;
};

type EventRow = {
  id?: unknown;
  event_type?: unknown;
  control_action?: unknown;
  request_idempotency_token?: unknown;
  payload_json?: unknown;
  metadata_json?: unknown;
  happened_at?: unknown;
  actor_user_id?: unknown;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown) {
  const numberValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function isMissingSchema(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return error.code === "42P01" || error.code === "42703" || error.code === "PGRST204" || message.includes("does not exist");
}

function calculateRisk(offenseCount: number, remainingSeconds: number | null, progressPercent: number) {
  if (offenseCount >= 3 || (remainingSeconds !== null && remainingSeconds < 300 && progressPercent < 60)) {
    return "high" as const;
  }
  if (offenseCount > 0 || progressPercent < 35) {
    return "medium" as const;
  }
  return "low" as const;
}

export async function loadMonitoringCompetition(competitionId: string): Promise<CompetitionRecord | null> {
  const supabase = await createClient();
  const result = await supabase
    .from("competitions")
    .select(COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .maybeSingle();

  if (!result.error) {
    return normalizeCompetitionRecord(result.data);
  }

  if (!isLegacyCompetitionSelectError(result.error as SupabaseError)) {
    return null;
  }

  const fallback = await supabase
    .from("competitions")
    .select(LEGACY_COMPETITION_SELECT_COLUMNS)
    .eq("id", competitionId)
    .maybeSingle();

  return fallback.error ? null : normalizeCompetitionRecord(fallback.data);
}

export async function loadMonitoringData(competitionId: string, registrations: OrganizerRegistrationDetail[]) {
  const [activeAttempts, events] = await Promise.all([
    listMonitoringAttemptSummaries(competitionId, registrations),
    listMonitoringCompetitionEvents(competitionId),
  ]);

  return { activeAttempts, events };
}

export async function listCompetitionScopedRegistrations(competitionId: string) {
  return listOrganizerCompetitionRegistrations({ competitionId });
}

async function listMonitoringAttemptSummaries(
  competitionId: string,
  registrations: OrganizerRegistrationDetail[],
): Promise<MonitoringAttemptSummary[]> {
  const supabase = await createClient();
  const registrationNames = new Map(registrations.map((registration) => [registration.id, registration.displayName]));
  const { data, error } = await supabase
    .from("competition_attempts")
    .select(
      "id, registration_id, status, started_at, total_time_seconds, final_score, raw_score, offense_count, effective_attempt_deadline_at, grade_summary_json",
    )
    .eq("competition_id", competitionId)
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingSchema(error as SupabaseError)) {
      return [];
    }

    throw new Error(error.message);
  }

  const attempts = ((data ?? []) as AttemptRow[]).map((row): MonitoringAttemptSummary | null => {
    const attemptId = readString(row.id);
    const registrationId = readString(row.registration_id);
    if (!attemptId || !registrationId) {
      return null;
    }

    const gradeSummary = readRecord(row.grade_summary_json);
    const score = readNumber(row.final_score) ?? readNumber(row.raw_score);
    const maxScore = readNumber(gradeSummary.max_score) ?? readNumber(gradeSummary.maxScore) ?? 100;
    const totalQuestions = readNumber(gradeSummary.total_questions) ?? readNumber(gradeSummary.totalQuestions);
    const answeredCount = readNumber(gradeSummary.answered_count) ?? readNumber(gradeSummary.answeredCount);
    const progressPercent =
      totalQuestions && answeredCount !== null
        ? Math.round((answeredCount / totalQuestions) * 100)
        : score !== null && maxScore
          ? Math.round((score / maxScore) * 100)
          : 0;
    const deadline = readString(row.effective_attempt_deadline_at);
    const remainingSeconds = deadline
      ? Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000))
      : null;
    const offenseCount = readNumber(row.offense_count) ?? 0;

    return {
      attemptId,
      registrationId,
      displayName: registrationNames.get(registrationId) ?? "Unknown participant",
      status: readString(row.status) ?? "in_progress",
      score,
      maxScore,
      startedAt: readString(row.started_at),
      lastSeenAt: readString(row.started_at),
      elapsedSeconds: readNumber(row.total_time_seconds),
      remainingSeconds,
      offenseCount,
      answeredCount,
      totalQuestions,
      progressPercent,
      riskLevel: calculateRisk(offenseCount, remainingSeconds, progressPercent),
    };
  });

  return attempts.filter((attempt): attempt is MonitoringAttemptSummary => attempt !== null);
}

async function listMonitoringCompetitionEvents(competitionId: string): Promise<MonitoringCompetitionEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competition_events")
    .select("id, event_type, control_action, request_idempotency_token, payload_json, metadata_json, happened_at, actor_user_id")
    .eq("competition_id", competitionId)
    .order("happened_at", { ascending: false })
    .limit(100);

  if (error) {
    if (isMissingSchema(error as SupabaseError)) {
      return [];
    }

    throw new Error(error.message);
  }

  const events = ((data ?? []) as EventRow[]).map((row): MonitoringCompetitionEvent | null => {
    const id = readString(row.id);
    const happenedAt = readString(row.happened_at);
    const eventType = readString(row.event_type);
    if (!id || !happenedAt || !eventType) {
      return null;
    }

    const payload = readRecord(row.payload_json);
    const metadata = readRecord(row.metadata_json);
    const actor = readString(metadata.actor_name) ?? readString(metadata.actorName) ?? readString(row.actor_user_id);

    return {
      id,
      happenedAt,
      eventType,
      controlAction: readString(row.control_action),
      reason: readString(metadata.reason) ?? readString(payload.reason),
      actorName: actor,
      actorRole: readString(metadata.actor_role) ?? readString(metadata.actorRole),
      result: readString(metadata.decision_outcome) ?? readString(metadata.decisionOutcome) ?? readString(payload.machine_code),
      metadata: {
        ...metadata,
        request_idempotency_token: readString(row.request_idempotency_token),
      },
    };
  });

  return events.filter((event): event is MonitoringCompetitionEvent => event !== null);
}
