import { jsonError } from "@/app/api/organizer/competitions/_shared";
import { runOrganizerControl, type MonitoringRouteContext } from "@/lib/monitoring/route-helpers";

export async function POST(request: Request, context: MonitoringRouteContext) {
  return runOrganizerControl(request, context, "pause_competition", ({
    competitionId,
    actorUserId,
    reason,
    token,
    competition,
  }) => {
    if (competition.type !== "open") {
      return jsonError("forbidden", "Organizer pause is available only for open live competitions.", 403);
    }

    return {
      p_competition_id: competitionId,
      p_reason: reason,
      p_request_idempotency_token: token,
      p_actor_user_id: actorUserId,
      p_actor_role: "organizer",
    };
  });
}
