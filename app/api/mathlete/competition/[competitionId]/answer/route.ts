import { jsonError, jsonOk, requireMathleteActor, requireSameOriginMutation } from "@/lib/arena/api";
import { saveArenaAnswer } from "@/lib/arena/server";
import type { AnswerStatusFlag } from "@/lib/arena/types";
import type { ProblemType } from "@/lib/problem-bank/types";

export async function POST(
  request: Request,
) {
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

  const payload = (await request.json().catch(() => ({}))) as {
    attemptId?: string;
    competitionProblemId?: string;
    problemType?: ProblemType;
    rawValue?: string;
    statusFlag?: AnswerStatusFlag;
    clientUpdatedAt?: string;
  };

  if (
    !payload.attemptId ||
    !payload.competitionProblemId ||
    !payload.problemType ||
    !payload.clientUpdatedAt
  ) {
    return jsonError("invalid_payload", "Attempt answer payload is incomplete.", 400);
  }

  const result = await saveArenaAnswer({
    attemptId: payload.attemptId,
    actorUserId: actorId,
    competitionProblemId: payload.competitionProblemId,
    problemType: payload.problemType,
    rawValue: payload.rawValue ?? "",
    statusFlag: payload.statusFlag ?? "blank",
    clientUpdatedAt: payload.clientUpdatedAt,
  });

  if (!result) {
    return jsonError("save_failed", "Answer save failed.", 409);
  }

  if (result.machine_code !== "ok") {
    return jsonError("save_failed", "Answer save failed.", 409, {
      machineCode: result.machine_code,
      data: {
        lastSavedAt: result.last_saved_at ?? null,
      },
    });
  }

  return jsonOk({
    machineCode: result.machine_code,
    data: {
      lastSavedAt: result.last_saved_at ?? null,
    },
  });
}
