import { jsonError, jsonOk, requireMathleteActor, requireSameOriginMutation } from "@/lib/arena/api";
import { createProblemDispute } from "@/lib/submission/server";

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

  const payload = (await request.json().catch(() => ({}))) as {
    competitionProblemId?: string;
    attemptId?: string;
    reason?: string;
  };
  const reason = payload.reason?.trim() ?? "";

  if (!payload.competitionProblemId || !payload.attemptId) {
    return jsonError("dispute_target_required", "Problem and attempt are required.", 400);
  }

  if (reason.length < 10 || reason.length > 1000) {
    return jsonError("invalid_reason", "Dispute reason must be 10 to 1000 characters.", 400);
  }

  const result = await createProblemDispute({
    competitionId,
    competitionProblemId: payload.competitionProblemId,
    attemptId: payload.attemptId,
    reporterId: actorId,
    reason,
  });

  if (!result || (result.machine_code !== "ok" && result.machine_code !== "already_open")) {
    return jsonError("dispute_failed", "Dispute submission failed.", 409, {
      machineCode: result?.machine_code ?? "unknown",
    });
  }

  return jsonOk({
    machineCode: result.machine_code,
    disputeId: result.dispute_id,
    status: result.status,
  });
}
