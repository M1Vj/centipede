import { jsonError, jsonOk, requireMathleteActor, requireSameOriginMutation } from "@/lib/arena/api";
import { requireSafeExamBrowserForAttemptStart } from "@/lib/safe-exam-browser";
import { loadArenaPageData, startCompetitionAttempt, startOpenCompetitionAttempt } from "@/lib/arena/server";
import { runDueScheduledCompetitionLifecycleSafely } from "@/lib/competition/scheduled-start";

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

  const safeExamBrowserGate = await requireSafeExamBrowserForAttemptStart(request, competitionId);
  if (!safeExamBrowserGate.ok) {
    return jsonError(safeExamBrowserGate.code, safeExamBrowserGate.message, 403);
  }

  const payload = (await request.json().catch(() => ({}))) as { registrationId?: string | null };

  await runDueScheduledCompetitionLifecycleSafely();

  const result = payload.registrationId
    ? await startCompetitionAttempt(payload.registrationId, actorId)
    : await startOpenCompetitionAttempt(competitionId, actorId);
  if (!result || result.machine_code !== "ok") {
    return jsonError("attempt_start_failed", "Attempt could not be started.", 409, {
      machineCode: result?.machine_code ?? "unknown",
    });
  }

  const data = await loadArenaPageData(competitionId, actorId);
  if (!data) {
    return jsonError("not_found", "Competition not found.", 404);
  }

  return jsonOk({ data, machineCode: result.machine_code });
}
