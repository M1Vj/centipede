import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  listCompetitionExportJobs,
  mapQueueExportMachineCodeToStatus,
  queueCompetitionExportJob,
} from "@/lib/exports/api";

type ActorProfile = {
  id: string;
  role: string;
  is_active: boolean | null;
};

type CompetitionOwnerRow = {
  id: string;
  organizer_id: string;
  is_deleted: boolean;
};

type QueueRequestBody = {
  format?: unknown;
  scope?: unknown;
};

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      code,
      message,
    },
    { status },
  );
}

function requireSameOriginMutation(request: Request) {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  let normalizedOriginHost = "";
  try {
    normalizedOriginHost = new URL(origin).host;
  } catch {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  if (normalizedOriginHost !== host) {
    return jsonError("forbidden", "Cross-site mutation requests are not allowed.", 403);
  }

  return null;
}

function getRequestIdempotencyToken(request: Request) {
  return (
    request.headers.get("x-idempotency-key") ?? request.headers.get("idempotency-key") ?? ""
  ).trim();
}

async function resolveActorContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: jsonError("unauthorized", "Authentication is required.", 401),
    } as const;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<ActorProfile>();

  if (error) {
    return {
      response: jsonError("auth_context_failed", "Unable to resolve actor context.", 500),
    } as const;
  }

  if (!profile || profile.is_active === false || (profile.role !== "organizer" && profile.role !== "admin")) {
    return {
      response: jsonError("forbidden", "You do not have permission for this operation.", 403),
    } as const;
  }

  return {
    supabase,
    actor: profile,
  } as const;
}

async function authorizeCompetition(input: {
  competitionId: string;
  actor: ActorProfile;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competitions")
    .select("id, organizer_id, is_deleted")
    .eq("id", input.competitionId)
    .maybeSingle<CompetitionOwnerRow>();

  if (error) {
    return {
      response: jsonError("competition_lookup_failed", "Unable to fetch competition.", 500),
    } as const;
  }

  if (!data || data.is_deleted) {
    return {
      response: jsonError("not_found", "Competition was not found.", 404),
    } as const;
  }

  if (input.actor.role !== "admin" && data.organizer_id !== input.actor.id) {
    return {
      response: jsonError("forbidden", "You do not have permission for this competition.", 403),
    } as const;
  }

  return { competition: data } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const actorContext = await resolveActorContext();
  if ("response" in actorContext) {
    return actorContext.response;
  }

  const { competitionId } = await params;
  const authorization = await authorizeCompetition({
    competitionId,
    actor: actorContext.actor,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const jobs = await listCompetitionExportJobs({ competitionId });
  return NextResponse.json({
    code: "ok",
    jobs,
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const actorContext = await resolveActorContext();
  if ("response" in actorContext) {
    return actorContext.response;
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return jsonError("service_unavailable", "Export queue is temporarily unavailable.", 503);
  }

  const { competitionId } = await params;
  const authorization = await authorizeCompetition({
    competitionId,
    actor: actorContext.actor,
  });

  if ("response" in authorization) {
    return authorization.response;
  }

  const token = getRequestIdempotencyToken(request);
  if (!token) {
    return jsonError("request_idempotency_token_required", "Request idempotency token is required.", 400);
  }

  const body = (await request.json().catch(() => null)) as QueueRequestBody | null;
  const format = body?.format;
  if (format !== "csv" && format !== "xlsx") {
    return jsonError("invalid_export_format", "Export format must be csv or xlsx.", 400);
  }

  const scope = typeof body?.scope === "string" ? body.scope.trim() : "";
  if (!scope) {
    return jsonError("invalid_export_scope", "Export scope is required.", 400);
  }

  const queued = await queueCompetitionExportJob({
    supabase: adminClient,
    competitionId,
    actorUserId: actorContext.actor.id,
    format,
    scope,
    requestIdempotencyToken: token,
  });

  if (queued.machineCode !== "ok" && queued.machineCode !== "deferred_owner_schema") {
    return jsonError(
      queued.machineCode,
      "Failed to queue export job.",
      mapQueueExportMachineCodeToStatus(queued.machineCode),
    );
  }

  return NextResponse.json({
    code: "ok",
    machineCode: queued.machineCode,
    exportJobId: queued.exportJobId,
    competitionId: queued.competitionId ?? competitionId,
    requestedBy: queued.requestedBy ?? actorContext.actor.id,
    format: queued.format ?? format,
    scope: queued.scope ?? scope,
    status: queued.status ?? "queued",
    replayed: queued.replayed,
    changed: queued.changed,
    createdAt: queued.createdAt,
  });
}
