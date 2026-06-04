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
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";

type PublishLeaderboardRpcRow = {
  machine_code: string;
  competition_id: string | null;
  leaderboard_published: boolean | null;
  event_id: string | null;
  replayed: boolean | null;
  changed: boolean | null;
};

function extractRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (!data) {
    return null;
  }

  return Array.isArray(data) ? (data[0] ?? null) : data;
}

function machineCodeToHttpStatus(machineCode: string) {
  if (machineCode === "forbidden") {
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

function machineCodeToMessage(machineCode: string) {
  switch (machineCode) {
    case "forbidden":
      return "You do not have permission for this operation.";
    case "not_found":
      return "Competition was not found.";
    case "deleted":
      return "Competition is already deleted.";
    case "invalid_transition":
      return "Leaderboard cannot be published for current competition state.";
    case "request_idempotency_token_required":
      return "Request idempotency token is required.";
    case "competition_id_required":
      return "Competition id is required.";
    default:
      return "Leaderboard publish failed.";
  }
}

function isPublishLeaderboardCompatibilityError(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    error.code === "42883" ||
    error.code === "PGRST202" ||
    message.includes("publish_leaderboard") ||
    message.includes("leaderboard_published")
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ competitionId: string }> },
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

  const { competitionId } = await params;
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

  const rpcResult = await adminResult.adminClient.rpc("publish_leaderboard", {
    p_competition_id: competitionId,
    p_request_idempotency_token: token,
    p_actor_user_id: actorResult.actor.userId,
  });

  if (rpcResult.error) {
    if (isPublishLeaderboardCompatibilityError(rpcResult.error)) {
      return jsonError(
        "service_unavailable",
        "Leaderboard publication is temporarily unavailable while migrations are incomplete.",
        503,
      );
    }

    return jsonDatabaseError(rpcResult.error);
  }

  const payload = extractRpcRow<PublishLeaderboardRpcRow>(rpcResult.data);
  if (!payload) {
    return jsonError("invalid_response", "Leaderboard publish returned no payload.", 502);
  }

  if (payload.machine_code !== "ok") {
    return jsonError(
      payload.machine_code,
      machineCodeToMessage(payload.machine_code),
      machineCodeToHttpStatus(payload.machine_code),
    );
  }

  const refreshResult = await adminResult.adminClient.rpc("refresh_leaderboard_entries", {
    p_competition_id: competitionId,
  });

  if (refreshResult.error) {
    if (isPublishLeaderboardCompatibilityError(refreshResult.error)) {
      return jsonError(
        "service_unavailable",
        "Leaderboard refresh is temporarily unavailable while migrations are incomplete.",
        503,
      );
    }

    return jsonDatabaseError(refreshResult.error);
  }

  await dispatchCompetitionNotification({
    event: "competition_leaderboard_published",
    eventIdentityKey: token,
    recipientId: actorResult.actor.userId,
    actorId: actorResult.actor.userId,
    competitionId,
    metadata: {
      competitionId,
      eventId: payload.event_id,
      replayed: payload.replayed === true,
    },
  });

  return jsonOk({
    code: "ok",
    machineCode: payload.machine_code,
    replayed: payload.replayed === true,
    changed: payload.changed === true,
    competitionId: payload.competition_id ?? competitionId,
    leaderboardPublished: payload.leaderboard_published === true,
    eventId: payload.event_id ?? null,
  });
}
