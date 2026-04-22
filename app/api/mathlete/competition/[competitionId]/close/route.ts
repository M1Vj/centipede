import { jsonError, jsonOk, requireMathleteActor, requireSameOriginMutation } from "@/lib/arena/api";
import { closeActiveAttemptInterval } from "@/lib/arena/server";

export async function POST(request: Request) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const { error, actorId } = await requireMathleteActor();
  if (error) {
    return error;
  }

  if (!actorId) {
    return jsonError("unauthorized", "Sign in required.", 401);
  }

  const payload = (await request.json().catch(() => ({}))) as { attemptId?: string };
  if (!payload.attemptId) {
    return jsonError("attempt_id_required", "Attempt id required.", 400);
  }

  const closedCount = await closeActiveAttemptInterval(payload.attemptId, actorId);
  return jsonOk({ closedCount });
}
