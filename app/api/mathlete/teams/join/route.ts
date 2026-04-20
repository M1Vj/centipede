import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";
import { fetchTeamByCode, getTeamRosterLock, hasTeamRegistrationConflict } from "@/lib/teams/guards";
import { attachTeamActionResource, reserveTeamAction } from "@/lib/teams/idempotency";
import { normalizeTeamMembershipRow } from "@/lib/teams/types";
import { validateIdempotencyToken, validateTeamCodeInput } from "@/lib/teams/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
  requireSameOriginMutation,
} from "@/app/api/mathlete/teams/_shared";

const JOIN_THROTTLE_WINDOW_MS = 1000;
const JOIN_THROTTLE_MAX_ENTRIES = 5000;
const joinThrottle = new Map<string, number>();

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }

  return "0.0.0.0";
}

function trimJoinThrottle(now: number) {
  const trimBefore = now - JOIN_THROTTLE_WINDOW_MS * 60;

  for (const [key, acceptedAt] of joinThrottle.entries()) {
    if (acceptedAt < trimBefore) {
      joinThrottle.delete(key);
    }
  }
}

function isJoinThrottled(ip: string, teamCode: string) {
  const now = Date.now();

  if (joinThrottle.size > JOIN_THROTTLE_MAX_ENTRIES) {
    trimJoinThrottle(now);
  }

  const throttleKey = `${ip}:${teamCode}`;
  const lastAcceptedAt = joinThrottle.get(throttleKey);

  if (typeof lastAcceptedAt === "number" && now - lastAcceptedAt < JOIN_THROTTLE_WINDOW_MS) {
    return true;
  }

  joinThrottle.set(throttleKey, now);
  return false;
}

function toJoinNotFound() {
  return jsonError("not_found", "Unable to join team with this code.", 404);
}

export async function POST(request: NextRequest) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | { teamCode?: string; requestIdempotencyToken?: string }
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

  const teamCodeValidation = validateTeamCodeInput(payload?.teamCode);
  if (!teamCodeValidation.ok || !teamCodeValidation.value) {
    return toJoinNotFound();
  }

  const clientIp = getClientIp(request);
  if (isJoinThrottled(clientIp, teamCodeValidation.value)) {
    return NextResponse.json(
      {
        code: "throttled",
        message: "Please wait before trying again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "1",
        },
      },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonError("service_unavailable", "Join service is unavailable.", 503);
  }

  try {
    const team = await fetchTeamByCode(admin, teamCodeValidation.value);
    if (!team || team.is_archived) {
      return toJoinNotFound();
    }

    const { actor } = auth;

    const { data: existingMembership, error: membershipError } = await admin
      .from("team_memberships")
      .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
      .eq("team_id", team.id)
      .eq("profile_id", actor.userId)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError) {
      return jsonDatabaseError(membershipError);
    }

    const membership = normalizeTeamMembershipRow(existingMembership);
    if (membership) {
      return jsonOk({
        code: "already_member",
        membership,
      });
    }

    const lock = await getTeamRosterLock(admin, team.id);
    if (lock.locked) {
      return toJoinNotFound();
    }

    const conflict = await hasTeamRegistrationConflict(admin, team.id, actor.userId);
    if (conflict.conflict) {
      return jsonError(
        "registration_conflict",
        "This team conflicts with an existing registered team.",
        409,
      );
    }

    const reservation = await reserveTeamAction(admin, {
      teamId: team.id,
      actorId: actor.userId,
      targetProfileId: actor.userId,
      actionType: "team_code_join",
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
        code: "joined",
        membership: normalizeTeamMembershipRow(replayMembership),
        replayed: true,
      });
    }

    const { data: newMembership, error: insertError } = await admin
      .from("team_memberships")
      .insert({
        team_id: team.id,
        profile_id: actor.userId,
        role: "member",
        is_active: true,
      })
      .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return jsonOk({
          code: "already_member",
        });
      }

      return jsonDatabaseError(insertError);
    }

    const normalizedMembership = normalizeTeamMembershipRow(newMembership);
    if (!normalizedMembership) {
      return jsonError("operation_failed", "Join request failed.", 500);
    }

    await attachTeamActionResource(admin, reservation.entryId, normalizedMembership.id);

    const { data: leaderRow } = await admin
      .from("team_memberships")
      .select("profile_id")
      .eq("team_id", team.id)
      .eq("role", "leader")
      .eq("is_active", true)
      .maybeSingle<{ profile_id: string }>();

    if (leaderRow?.profile_id) {
      await dispatchTeamNotification({
        event: "team_invite_accepted",
        eventIdentityKey: `team_invite_accepted:code:${team.id}:${actor.userId}`,
        recipientId: leaderRow.profile_id,
        actorId: actor.userId,
        teamId: team.id,
        inviteId: null,
        metadata: {
          joinMethod: "code",
        },
      });
    }

    return jsonOk({
      code: "joined",
      membership: normalizedMembership,
    });
  } catch (error) {
    return jsonDatabaseError(error);
  }
}
