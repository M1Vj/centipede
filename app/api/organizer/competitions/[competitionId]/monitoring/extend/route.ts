import { jsonError } from "@/app/api/organizer/competitions/_shared";
import {
  runOrganizerControl,
  type MonitoringRouteContext,
} from "@/lib/monitoring/route-helpers";

export async function POST(request: Request, context: MonitoringRouteContext) {
  return runOrganizerControl(request, context, "extend_competition", ({
    competitionId,
    actorUserId,
    reason,
    token,
    body,
  }) => {
    const additionalMinutes = Number(body.additionalMinutes ?? body.additional_minutes);
    if (!Number.isInteger(additionalMinutes) || additionalMinutes <= 0) {
      return jsonError("invalid_additional_minutes", "Additional minutes must be positive.", 400);
    }

    return {
      p_competition_id: competitionId,
      p_additional_minutes: additionalMinutes,
      p_reason: reason,
      p_request_idempotency_token: token,
      p_actor_user_id: actorUserId,
      p_actor_role: "organizer",
    };
  });
}
