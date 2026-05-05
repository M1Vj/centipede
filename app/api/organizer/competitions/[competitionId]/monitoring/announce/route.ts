import {
  fetchCompetition,
  jsonError,
  jsonOk,
  requireCompetitionAdminClient,
  requireOrganizerCompetitionActor,
  requireSameOriginMutation,
} from "@/app/api/organizer/competitions/_shared";
import { sendCompetitionAnnouncement } from "@/lib/monitoring/api";
import {
  parseAnnouncementAudience,
  parseJsonBody,
  readNonEmptyString,
  type MonitoringRouteContext,
} from "@/lib/monitoring/route-helpers";

export async function POST(request: Request, context: MonitoringRouteContext) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const body = await parseJsonBody(request);
  const title = readNonEmptyString(body?.title);
  const messageBody = readNonEmptyString(body?.body);
  const audience = parseAnnouncementAudience(body?.audience);

  if (!title || !messageBody) {
    return jsonError("announcement_body_required", "Announcement title and body are required.", 400);
  }

  if (!audience) {
    return jsonError("invalid_audience", "Announcement audience is invalid.", 400);
  }

  const actorResult = await requireOrganizerCompetitionActor();
  if ("response" in actorResult) {
    return actorResult.response;
  }

  const { competitionId } = await context.params;
  const competitionResult = await fetchCompetition(
    actorResult.supabase,
    competitionId,
    actorResult.actor.userId,
  );

  if ("response" in competitionResult) {
    return competitionResult.response;
  }

  const adminResult = requireCompetitionAdminClient();
  if ("response" in adminResult) {
    return adminResult.response;
  }

  const result = await sendCompetitionAnnouncement({
    admin: adminResult.adminClient,
    competitionId,
    actorUserId: actorResult.actor.userId,
    title,
    body: messageBody,
    audience,
  });

  if (result.error) {
    return jsonError("announcement_failed", "Announcement could not be sent.", 500);
  }

  return jsonOk({
    code: "ok",
    announcementId: typeof result.announcement?.id === "string" ? result.announcement.id : null,
    competitionId,
    audience,
    dispatchCount: result.dispatchCount,
  });
}
