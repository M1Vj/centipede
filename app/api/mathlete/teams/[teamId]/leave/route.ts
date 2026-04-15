import { createAdminClient } from "@/lib/supabase/admin";
import { fetchActiveMembership, getTeamRosterLock } from "@/lib/teams/guards";
import { attachTeamActionResource, reserveTeamAction } from "@/lib/teams/idempotency";
import { normalizeTeamMembershipRow } from "@/lib/teams/types";
import { validateIdempotencyToken } from "@/lib/teams/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
  requireSameOriginMutation,
} from "@/app/api/mathlete/teams/_shared";

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { teamId } = await context.params;
  const payload = (await request.json().catch(() => null)) as
    | { requestIdempotencyToken?: string }
    | null;

  const tokenValidation = validateIdempotencyToken(payload?.requestIdempotencyToken);
  if (!tokenValidation.ok || !tokenValidation.value) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      { errors: tokenValidation.errors },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonError("service_unavailable", "Team service is unavailable.", 503);
  }

  const { actor } = auth;

  try {
    const membership = await fetchActiveMembership(admin, teamId, actor.userId);
    if (!membership) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    const lock = await getTeamRosterLock(admin, teamId);
    if (lock.locked) {
      return jsonError(
        "roster_locked",
        "Team roster changes are locked for an active registration.",
        409,
      );
    }

    const reservation = await reserveTeamAction(admin, {
      teamId,
      actorId: actor.userId,
      targetProfileId: actor.userId,
      actionType: "member_leave",
      idempotencyToken: tokenValidation.value,
    });

    if (reservation.resourceId) {
      const { data: replayMembership, error: replayError } = await admin
        .from("team_memberships")
        .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
        .eq("id", reservation.resourceId)
        .maybeSingle();

      if (replayError) {
        return jsonDatabaseError(replayError);
      }

      return jsonOk({
        code: "left",
        membership: normalizeTeamMembershipRow(replayMembership),
        replayed: true,
      });
    }

    const { data: updatedMembership, error: updateError } = await admin
      .from("team_memberships")
      .update({
        is_active: false,
        left_at: new Date().toISOString(),
      })
      .eq("team_id", teamId)
      .eq("profile_id", actor.userId)
      .eq("is_active", true)
      .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
      .maybeSingle();

    if (updateError) {
      return jsonDatabaseError(updateError);
    }

    const normalizedMembership = normalizeTeamMembershipRow(updatedMembership);
    if (!normalizedMembership) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    await attachTeamActionResource(admin, reservation.entryId, normalizedMembership.id);

    return jsonOk({
      code: "left",
      membership: normalizedMembership,
    });
  } catch (error) {
    return jsonDatabaseError(error);
  }
}
