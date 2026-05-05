import { jsonError } from "@/app/api/organizer/competitions/_shared";
import {
  readNonEmptyString,
  runOrganizerControl,
  type MonitoringRouteContext,
} from "@/lib/monitoring/route-helpers";

export async function POST(request: Request, context: MonitoringRouteContext) {
  return runOrganizerControl(request, context, "reset_attempt_for_disconnect", ({
    competitionId,
    actorUserId,
    reason,
    token,
    body,
  }) => {
    const attemptId = readNonEmptyString(body.attemptId ?? body.attempt_id);
    const evidenceType = readNonEmptyString(body.disconnectEvidenceType ?? body.disconnect_evidence_type);
    const evidenceRef = readNonEmptyString(body.disconnectEvidenceRef ?? body.disconnect_evidence_ref);
    if (!attemptId) {
      return jsonError("attempt_id_required", "Attempt id is required.", 400);
    }

    return {
      p_competition_id: competitionId,
      p_attempt_id: attemptId,
      p_reason: reason,
      p_request_idempotency_token: token,
      p_actor_user_id: actorUserId,
      p_disconnect_evidence_type: evidenceType || null,
      p_disconnect_evidence_ref: evidenceRef || null,
    };
  });
}
