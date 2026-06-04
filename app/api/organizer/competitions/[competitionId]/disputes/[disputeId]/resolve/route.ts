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
import { mapDisputeMachineCodeToStatus } from "@/lib/disputes/api";
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";

type ResolveDisputeRpcRow = {
  machine_code: string;
  dispute_id: string | null;
  competition_id: string | null;
  status: "open" | "reviewing" | "accepted" | "rejected" | "resolved" | null;
  correction_id: string | null;
  replayed: boolean | null;
  changed: boolean | null;
  resolved_at: string | null;
};

type ResolveDisputeBody = {
  status?: "reviewing" | "accepted" | "rejected" | "resolved";
  resolutionNote?: string;
};

const RESOLVABLE_STATUSES = new Set<ResolveDisputeBody["status"]>([
  "reviewing",
  "accepted",
  "rejected",
  "resolved",
]);

function isResolveDisputeCompatibilityError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("resolve_problem_dispute") ||
    message.includes("problem_disputes")
  );
}

function extractRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (!data) {
    return null;
  }

  return Array.isArray(data) ? (data[0] ?? null) : data;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ competitionId: string; disputeId: string }> },
) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const actorResult = await requireOrganizerCompetitionActor();
  if ("response" in actorResult) {
    return actorResult.response;
  }

  const adminResult = requireCompetitionAdminClient();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const { competitionId, disputeId } = await params;
  const token = getRequestIdempotencyToken(request);
  if (!token) {
    return jsonError("request_idempotency_token_required", "Request idempotency token is required.", 400);
  }

  const competitionResult = await fetchCompetition(
    actorResult.supabase,
    competitionId,
    actorResult.actor.userId,
  );

  if ("response" in competitionResult) {
    return competitionResult.response;
  }

  const body = (await request.json().catch(() => null)) as ResolveDisputeBody | null;
  const status = body?.status;
  const resolutionNote =
    typeof body?.resolutionNote === "string" ? body.resolutionNote.trim() : "";

  if (!status || !RESOLVABLE_STATUSES.has(status)) {
    return jsonError("invalid_status", "A valid dispute status is required.", 400);
  }

  if ((status === "accepted" || status === "rejected" || status === "resolved") && !resolutionNote) {
    return jsonError("resolution_note_required", "Resolution note is required for terminal decisions.", 400);
  }

  const rpcResult = await adminResult.adminClient.rpc("resolve_problem_dispute", {
    p_dispute_id: disputeId,
    p_status: status,
    p_resolution_note: resolutionNote,
    p_request_idempotency_token: token,
    p_actor_user_id: actorResult.actor.userId,
  });

  if (rpcResult.error) {
    if (isResolveDisputeCompatibilityError(rpcResult.error)) {
      return jsonError(
        "service_unavailable",
        "Dispute resolution is temporarily unavailable while migrations are incomplete.",
        503,
      );
    }

    return jsonDatabaseError(rpcResult.error);
  }

  const payload = extractRpcRow<ResolveDisputeRpcRow>(rpcResult.data);
  if (!payload) {
    return jsonError("invalid_response", "Dispute resolution returned no payload.", 502);
  }

  if (payload.competition_id && payload.competition_id !== competitionId) {
    return jsonError("competition_mismatch", "Dispute does not belong to this competition.", 409);
  }

  if (payload.machine_code !== "ok") {
    return jsonError(
      payload.machine_code,
      "Dispute resolution failed.",
      mapDisputeMachineCodeToStatus(payload.machine_code),
    );
  }

  await dispatchCompetitionNotification({
    event: "competition_problem_dispute_resolved",
    eventIdentityKey: token,
    recipientId: actorResult.actor.userId,
    actorId: actorResult.actor.userId,
    competitionId,
    metadata: {
      disputeId: payload.dispute_id ?? disputeId,
      status: payload.status,
      correctionId: payload.correction_id,
      resolvedAt: payload.resolved_at,
      replayed: payload.replayed === true,
    },
  });

  return jsonOk({
    code: "ok",
    machineCode: payload.machine_code,
    disputeId: payload.dispute_id ?? disputeId,
    competitionId: payload.competition_id ?? competitionId,
    status: payload.status,
    correctionId: payload.correction_id,
    replayed: payload.replayed === true,
    changed: payload.changed === true,
    resolvedAt: payload.resolved_at,
  });
}
