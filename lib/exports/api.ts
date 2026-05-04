import { createClient } from "@/lib/supabase/server";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

type ExportJobRow = {
  id: string;
  competition_id: string;
  requested_by: string;
  format: "csv" | "xlsx";
  scope: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  download_url: string | null;
  error_message: string | null;
  request_idempotency_token: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type QueueExportJobRpcRow = {
  machine_code: string;
  export_job_id: string | null;
  competition_id: string | null;
  requested_by: string | null;
  format: "csv" | "xlsx" | null;
  scope: string | null;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled" | null;
  replayed: boolean | null;
  changed: boolean | null;
  created_at: string | null;
};

export type ExportJob = {
  id: string;
  competitionId: string;
  requestedBy: string;
  format: "csv" | "xlsx";
  scope: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  downloadUrl: string | null;
  errorMessage: string | null;
  requestIdempotencyToken: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type QueueExportJobResult = {
  machineCode: string;
  exportJobId: string | null;
  competitionId: string | null;
  requestedBy: string | null;
  format: "csv" | "xlsx" | null;
  scope: string | null;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled" | null;
  replayed: boolean;
  changed: boolean;
  createdAt: string | null;
};

function isExportSchemaCompatibilityError(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("export_jobs") ||
    message.includes("queue_export_job")
  );
}

function extractRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (!data) {
    return null;
  }

  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function normalizeQueueExportJobResult(row: QueueExportJobRpcRow | null): QueueExportJobResult {
  if (!row) {
    return {
      machineCode: "unknown_response",
      exportJobId: null,
      competitionId: null,
      requestedBy: null,
      format: null,
      scope: null,
      status: null,
      replayed: false,
      changed: false,
      createdAt: null,
    };
  }

  return {
    machineCode: row.machine_code,
    exportJobId: row.export_job_id,
    competitionId: row.competition_id,
    requestedBy: row.requested_by,
    format: row.format,
    scope: row.scope,
    status: row.status,
    replayed: row.replayed === true,
    changed: row.changed === true,
    createdAt: row.created_at,
  };
}

function normalizeExportJob(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    competitionId: row.competition_id,
    requestedBy: row.requested_by,
    format: row.format,
    scope: row.scope,
    status: row.status,
    downloadUrl: row.download_url,
    errorMessage: row.error_message,
    requestIdempotencyToken: row.request_idempotency_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function queueCompetitionExportJob(input: {
  competitionId: string;
  actorUserId: string;
  format: "csv" | "xlsx";
  scope: string;
  requestIdempotencyToken: string;
}): Promise<QueueExportJobResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("queue_export_job", {
    p_competition_id: input.competitionId,
    p_format: input.format,
    p_scope: input.scope,
    p_request_idempotency_token: input.requestIdempotencyToken,
    p_actor_user_id: input.actorUserId,
  });

  if (error) {
    if (isExportSchemaCompatibilityError(error)) {
      return {
        machineCode: "deferred_owner_schema",
        exportJobId: null,
        competitionId: input.competitionId,
        requestedBy: input.actorUserId,
        format: input.format,
        scope: input.scope,
        status: null,
        replayed: false,
        changed: false,
        createdAt: null,
      };
    }

    throw error;
  }

  return normalizeQueueExportJobResult(extractRpcRow<QueueExportJobRpcRow>(data));
}

export async function listCompetitionExportJobs(input: {
  competitionId: string;
}): Promise<ExportJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("export_jobs")
    .select(
      "id, competition_id, requested_by, format, scope, status, download_url, error_message, request_idempotency_token, created_at, updated_at, completed_at",
    )
    .eq("competition_id", input.competitionId)
    .order("created_at", { ascending: false })
    .returns<ExportJobRow[]>();

  if (error) {
    if (isExportSchemaCompatibilityError(error)) {
      return [];
    }

    throw error;
  }

  return (data ?? []).map((row) => normalizeExportJob(row));
}

export function mapQueueExportMachineCodeToStatus(machineCode: string): number {
  if (
    machineCode === "forbidden" ||
    machineCode === "unauthorized" ||
    machineCode === "actor_required"
  ) {
    return 403;
  }

  if (machineCode === "not_found" || machineCode === "deleted") {
    return 404;
  }

  if (
    machineCode === "invalid_transition" ||
    machineCode === "request_idempotency_token_required" ||
    machineCode === "competition_id_required"
  ) {
    return 409;
  }

  return 400;
}
