import { normalizeCompetitionLifecycleResult } from "@/lib/competition/api";
import { createAdminClient } from "@/lib/supabase/admin";

type DueCompetitionRow = {
  id?: string | null;
  start_time?: string | null;
  startTime?: string | null;
  end_time?: string | null;
  endTime?: string | null;
  duration_minutes?: number | null;
  durationMinutes?: number | null;
};

type ScheduledStartLifecycleResult = {
  competitionId: string;
  requestIdempotencyToken: string;
  machineCode: string;
  status: string | null;
  eventId: string | null;
  replayed: boolean;
  changed: boolean;
};

export type ScheduledStartSummary = {
  attempted: number;
  started: number;
  skipped: number;
  results: ScheduledStartLifecycleResult[];
  serviceUnavailable?: boolean;
};

export type ScheduledEndSummary = {
  attempted: number;
  ended: number;
  skipped: number;
  results: ScheduledStartLifecycleResult[];
  serviceUnavailable?: boolean;
};

function normalizeStartTime(row: DueCompetitionRow) {
  return typeof row.start_time === "string"
    ? row.start_time
    : typeof row.startTime === "string"
      ? row.startTime
      : "";
}

function normalizeEndTime(row: DueCompetitionRow) {
  return typeof row.end_time === "string"
    ? row.end_time
    : typeof row.endTime === "string"
      ? row.endTime
      : "";
}

function normalizeDurationMinutes(row: DueCompetitionRow) {
  return typeof row.duration_minutes === "number"
    ? row.duration_minutes
    : typeof row.durationMinutes === "number"
      ? row.durationMinutes
      : 0;
}

function resolveScheduledEndTime(row: DueCompetitionRow) {
  const explicitEndTime = normalizeEndTime(row);
  if (explicitEndTime) {
    return explicitEndTime;
  }

  const startTime = normalizeStartTime(row);
  const durationMinutes = normalizeDurationMinutes(row);
  if (!startTime || durationMinutes <= 0) {
    return "";
  }

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) {
    return "";
  }

  return new Date(start.getTime() + durationMinutes * 60000).toISOString();
}

export async function startDueScheduledCompetitions(now = new Date()): Promise<ScheduledStartSummary> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      attempted: 0,
      started: 0,
      skipped: 0,
      results: [],
      serviceUnavailable: true,
    };
  }

  const { data, error } = await admin
    .from("competitions")
    .select("id, start_time")
    .eq("type", "scheduled")
    .eq("status", "published")
    .eq("is_deleted", false)
    .lte("start_time", now.toISOString())
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as DueCompetitionRow[];
  const results: ScheduledStartLifecycleResult[] = [];
  let started = 0;
  let skipped = 0;

  for (const row of rows) {
    const competitionId = typeof row.id === "string" ? row.id : "";
    const startTime = normalizeStartTime(row);

    if (!competitionId || !startTime) {
      skipped += 1;
      continue;
    }

    const requestIdempotencyToken = `scheduled-start:${competitionId}:${startTime}`;
    const { data: rpcData, error: rpcError } = await admin.rpc("start_competition", {
      p_competition_id: competitionId,
      p_request_idempotency_token: requestIdempotencyToken,
    });

    if (rpcError) {
      results.push({
        competitionId,
        requestIdempotencyToken,
        machineCode: "operation_failed",
        status: null,
        eventId: null,
        replayed: false,
        changed: false,
      });
      skipped += 1;
      continue;
    }

    const lifecycleResult = normalizeCompetitionLifecycleResult(rpcData);
    const normalized = lifecycleResult
      ? {
          machineCode: lifecycleResult.machineCode,
          status: lifecycleResult.status,
          eventId: lifecycleResult.eventId,
          replayed: lifecycleResult.replayed,
          changed: lifecycleResult.changed,
        }
      : {
          machineCode: "operation_failed",
          status: null,
          eventId: null,
          replayed: false,
          changed: false,
        };

    results.push({
      competitionId,
      requestIdempotencyToken,
      ...normalized,
    });

    if (normalized.machineCode === "ok") {
      started += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    attempted: rows.length,
    started,
    skipped,
    results,
  };
}

export async function startDueScheduledCompetitionsSafely(now = new Date()) {
  try {
    return await startDueScheduledCompetitions(now);
  } catch (error) {
    console.error("Failed to start due scheduled competitions:", error);
    return null;
  }
}

export async function endDueScheduledCompetitions(now = new Date()): Promise<ScheduledEndSummary> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      attempted: 0,
      ended: 0,
      skipped: 0,
      results: [],
      serviceUnavailable: true,
    };
  }

  const { data, error } = await admin
    .from("competitions")
    .select("id, start_time, end_time, duration_minutes")
    .eq("type", "scheduled")
    .in("status", ["live", "paused"])
    .eq("is_deleted", false)
    .order("end_time", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as DueCompetitionRow[]).filter((row) => {
    const endTime = resolveScheduledEndTime(row);
    const endTimestamp = endTime ? new Date(endTime).getTime() : Number.NaN;
    return !Number.isNaN(endTimestamp) && endTimestamp <= now.getTime();
  });
  const results: ScheduledStartLifecycleResult[] = [];
  let ended = 0;
  let skipped = 0;

  for (const row of rows) {
    const competitionId = typeof row.id === "string" ? row.id : "";
    if (!competitionId) {
      skipped += 1;
      continue;
    }

    const endTime = new Date(resolveScheduledEndTime(row)).toISOString();
    const requestIdempotencyToken = `system_end:${competitionId}:${endTime}`;
    const { data: rpcData, error: rpcError } = await admin.rpc("end_competition", {
      p_competition_id: competitionId,
      p_reason: null,
      p_request_idempotency_token: requestIdempotencyToken,
      p_transition_source: "system_timer",
    });

    if (rpcError) {
      results.push({
        competitionId,
        requestIdempotencyToken,
        machineCode: "operation_failed",
        status: null,
        eventId: null,
        replayed: false,
        changed: false,
      });
      skipped += 1;
      continue;
    }

    const lifecycleResult = normalizeCompetitionLifecycleResult(rpcData);
    const normalized = lifecycleResult
      ? {
          machineCode: lifecycleResult.machineCode,
          status: lifecycleResult.status,
          eventId: lifecycleResult.eventId,
          replayed: lifecycleResult.replayed,
          changed: lifecycleResult.changed,
          requestIdempotencyToken: lifecycleResult.requestIdempotencyToken,
        }
      : {
          machineCode: "operation_failed",
          status: null,
          eventId: null,
          replayed: false,
          changed: false,
          requestIdempotencyToken,
        };

    results.push({
      competitionId,
      ...normalized,
    });

    if (normalized.machineCode === "ok") {
      ended += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    attempted: rows.length,
    ended,
    skipped,
    results,
  };
}

export async function endDueScheduledCompetitionsSafely(now = new Date()) {
  try {
    return await endDueScheduledCompetitions(now);
  } catch (error) {
    console.error("Failed to end due scheduled competitions:", error);
    return null;
  }
}

export async function runDueScheduledCompetitionLifecycleSafely(now = new Date()) {
  const startSummary = await startDueScheduledCompetitionsSafely(now);
  const endSummary = await endDueScheduledCompetitionsSafely(now);

  return { startSummary, endSummary };
}
