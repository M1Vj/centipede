import { jsonError, jsonOk, requireMathleteActor, requireSameOriginMutation } from "@/lib/arena/api";
import { createProblemDispute } from "@/lib/submission/server";

function disputeFailureFor(machineCode: string) {
  switch (machineCode) {
    case "competition_not_found":
      return {
        code: "competition_not_found",
        message: "Competition was not found.",
        status: 404,
      };
    case "competition_not_ended":
      return {
        code: "competition_not_ended",
        message: "Disputes open only after the answer key is visible for your completed attempt.",
        status: 409,
      };
    case "dispute_rate_limited":
      return {
        code: "dispute_rate_limited",
        message: "Please wait before submitting another dispute for this problem.",
        status: 429,
      };
    case "forbidden":
      return {
        code: "forbidden",
        message: "You can only dispute problems from your own completed attempt.",
        status: 403,
      };
    case "invalid_reason":
      return {
        code: "invalid_reason",
        message: "Dispute reason must be 10 to 1000 characters.",
        status: 400,
      };
    case "target_required":
      return {
        code: "dispute_target_required",
        message: "Problem and attempt are required.",
        status: 400,
      };
    default:
      return {
        code: "dispute_failed",
        message: "Dispute submission failed.",
        status: 409,
      };
  }
}

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
    const failure = disputeFailureFor(result?.machine_code ?? "unknown");

    return jsonError(failure.code, failure.message, failure.status, {
      machineCode: result?.machine_code ?? "unknown",
    });
  }

  return jsonOk({
    machineCode: result.machine_code,
    disputeId: result.dispute_id,
    status: result.status,
  });
}
