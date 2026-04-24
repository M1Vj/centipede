import { normalizeCompetitionLifecycleResult } from "@/lib/competition/api";
import { createAdminClient } from "@/lib/supabase/admin";

type DueCompetitionRow = {
  id?: string | null;
  start_time?: string | null;
  startTime?: string | null;
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

function normalizeStartTime(row: DueCompetitionRow) {
  return typeof row.start_time === "string"
    ? row.start_time
    : typeof row.startTime === "string"
      ? row.startTime
      : "";
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
