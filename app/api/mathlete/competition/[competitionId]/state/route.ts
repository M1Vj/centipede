import { jsonError, jsonOk, requireMathleteActor } from "@/lib/arena/api";
import { syncAttemptStateForClient } from "@/lib/arena/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ competitionId: string }> },
) {
  const { competitionId } = await context.params;
  const { error, actorId } = await requireMathleteActor();

  if (error) {
    return error;
  }

  if (!actorId) {
    return jsonError("unauthorized", "Sign in required.", 401);
  }

  const data = await syncAttemptStateForClient(competitionId, actorId);
  if (!data) {
    return jsonError("not_found", "Competition not found.", 404);
  }

  return jsonOk({ data });
}
