import { createClient } from "@/lib/supabase/server";
import {
  fetchCompetition,
  getRequestIdempotencyToken,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireCompetitionAdminClient,
  requireOrganizerCompetitionActor,
  requireSameOriginMutation,
} from "@/app/api/organizer/competitions/_shared";
import {
  isMonitoringAnnouncementAudience,
  normalizeMonitoringControlResult,
} from "./api";
import type { MonitoringAnnouncementAudience, MonitoringControlResult } from "./types";

type AdminActorProfile = {
  id: string;
  role: string;
  is_active: boolean | null;
};

export type MonitoringRouteContext = {
  params: Promise<{ competitionId: string }>;
};

export function readNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
}

export async function parseJsonBody(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}

export function monitoringMachineCodeStatus(machineCode: string) {
  if (machineCode === "forbidden") {
    return 403;
  }

  if (machineCode === "not_found" || machineCode === "attempt_not_found" || machineCode === "deleted") {
    return 404;
  }

  if (
    machineCode === "reason_required" ||
    machineCode === "request_idempotency_token_required" ||
    machineCode === "invalid_additional_minutes" ||
    machineCode === "invalid_transition" ||
    machineCode.startsWith("rejected_")
  ) {
    return 409;
  }

  return 400;
}

export function monitoringMachineCodeMessage(machineCode: string) {
  switch (machineCode) {
    case "forbidden":
      return "You do not have permission for this operation.";
    case "not_found":
    case "attempt_not_found":
      return "Requested resource was not found.";
    case "deleted":
      return "Competition is already deleted.";
    case "invalid_transition":
      return "Competition is not in correct state for this action.";
    case "reason_required":
      return "Reason is required.";
    case "request_idempotency_token_required":
      return "Request idempotency token is required.";
    case "invalid_additional_minutes":
      return "Additional minutes must be positive.";
    default:
      return "Monitoring control failed.";
  }
}

export function controlOkPayload(result: MonitoringControlResult, competitionId: string) {
  return {
    code: "ok",
    machineCode: result.machineCode,
    competitionId: result.competitionId ?? competitionId,
    status: result.status,
    eventId: result.eventId,
    replayed: result.replayed,
    changed: result.changed,
    requestIdempotencyToken: result.requestIdempotencyToken,
    decisionOutcome: result.decisionOutcome,
  };
}

export async function runOrganizerControl(
  request: Request,
  context: MonitoringRouteContext,
  rpcName: string,
  buildArgs: (input: {
    competitionId: string;
    actorUserId: string;
    reason: string;
    token: string;
    body: Record<string, unknown>;
  }) => Record<string, unknown> | Response,
) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await parseJsonBody(request);
  const reason = readNonEmptyString(body?.reason);
  if (!reason) {
    return jsonError("reason_required", "Reason is required.", 400);
  }

  const token = getRequestIdempotencyToken(request);
  if (!token) {
    return jsonError("request_idempotency_token_required", "Request idempotency token is required.", 400);
  }

  const actorResult = await requireOrganizerCompetitionActor();
  if ("response" in actorResult) {
    return actorResult.response;
  }

  const { competitionId } = await context.params;
  const competitionResult = await fetchCompetition(
    actorResult.supabase,
    competitionId,
    actorResult.actor.userId,
  );

  if ("response" in competitionResult) {
    return competitionResult.response;
  }

  const adminResult = requireCompetitionAdminClient();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const rpcArgs = buildArgs({
    competitionId,
    actorUserId: actorResult.actor.userId,
    reason,
    token,
    body: body ?? {},
  });

  if (rpcArgs instanceof Response) {
    return rpcArgs;
  }

  const rpcResult = await adminResult.adminClient.rpc(rpcName, rpcArgs);
  if (rpcResult.error) {
    return jsonDatabaseError(rpcResult.error);
  }

  const result = normalizeMonitoringControlResult(rpcResult.data);
  if (!result) {
    return jsonError("invalid_response", "Monitoring control returned no payload.", 502);
  }

  if (result.machineCode !== "ok") {
    return jsonError(
      result.machineCode,
      monitoringMachineCodeMessage(result.machineCode),
      monitoringMachineCodeStatus(result.machineCode),
    );
  }

  return jsonOk(controlOkPayload(result, competitionId));
}

export async function requireAdminMonitoringActor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: jsonError("unauthorized", "Authentication is required.", 401) } as const;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .maybeSingle<AdminActorProfile>();

  if (error) {
    return { response: jsonError("auth_context_failed", "Unable to resolve actor context.", 500) } as const;
  }

  if (!profile || profile.role !== "admin" || profile.is_active === false) {
    return { response: jsonError("forbidden", "You do not have permission for this operation.", 403) } as const;
  }

  return { actor: { userId: profile.id, role: "admin" as const } } as const;
}

export async function runAdminControl(
  request: Request,
  context: MonitoringRouteContext,
  rpcName: string,
  buildArgs: (input: {
    competitionId: string;
    actorUserId: string;
    reason: string;
    token: string;
    body: Record<string, unknown>;
  }) => Record<string, unknown> | Response,
) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await parseJsonBody(request);
  const reason = readNonEmptyString(body?.reason);
  if (!reason) {
    return jsonError("reason_required", "Reason is required.", 400);
  }

  const token = getRequestIdempotencyToken(request);
  if (!token) {
    return jsonError("request_idempotency_token_required", "Request idempotency token is required.", 400);
  }

  const actorResult = await requireAdminMonitoringActor();
  if ("response" in actorResult) {
    return actorResult.response;
  }

  const adminResult = requireCompetitionAdminClient();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const { competitionId } = await context.params;
  const rpcArgs = buildArgs({
    competitionId,
    actorUserId: actorResult.actor.userId,
    reason,
    token,
    body: body ?? {},
  });

  if (rpcArgs instanceof Response) {
    return rpcArgs;
  }

  const rpcResult = await adminResult.adminClient.rpc(rpcName, rpcArgs);
  if (rpcResult.error) {
    return jsonDatabaseError(rpcResult.error);
  }

  const result = normalizeMonitoringControlResult(rpcResult.data);
  if (!result) {
    return jsonError("invalid_response", "Monitoring control returned no payload.", 502);
  }

  if (result.machineCode !== "ok") {
    return jsonError(
      result.machineCode,
      monitoringMachineCodeMessage(result.machineCode),
      monitoringMachineCodeStatus(result.machineCode),
    );
  }

  return jsonOk(controlOkPayload(result, competitionId));
}

export function parseAnnouncementAudience(value: unknown): MonitoringAnnouncementAudience | null {
  return isMonitoringAnnouncementAudience(value) ? value : null;
}
