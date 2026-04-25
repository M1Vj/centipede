import { jsonError, jsonOk, requireMathleteActor, requireSameOriginMutation } from "@/lib/arena/api";
import { loadArenaPageData, registerForCompetition } from "@/lib/arena/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ competitionId: string }> },
) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const { competitionId } = await context.params;
  const { error, actorId } = await requireMathleteActor();
  if (error) {
    return error;
  }

  if (!actorId) {
    return jsonError("unauthorized", "Sign in required.", 401);
  }

  const payload = (await request.json().catch(() => ({}))) as { teamId?: string | null };
  const result = await registerForCompetition(competitionId, actorId, payload.teamId ?? null);

  if (!result || result.machine_code !== "ok") {
    return jsonError("registration_failed", "Competition registration failed.", 409, {
      machineCode: result?.machine_code ?? "unknown",
    });
  }

  const data = await loadArenaPageData(competitionId, actorId);
  if (!data) {
    return jsonError("not_found", "Competition not found.", 404);
  }

  return jsonOk({ data, machineCode: result.machine_code });
}
