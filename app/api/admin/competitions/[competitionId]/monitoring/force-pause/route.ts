import { runAdminControl, type MonitoringRouteContext } from "@/lib/monitoring/route-helpers";

export async function POST(request: Request, context: MonitoringRouteContext) {
  return runAdminControl(request, context, "pause_competition", ({
    competitionId,
    actorUserId,
    reason,
    token,
  }) => ({
    p_competition_id: competitionId,
    p_reason: reason,
    p_request_idempotency_token: token,
    p_actor_user_id: actorUserId,
    p_actor_role: "admin",
  }));
}
