import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";
import {
  fetchActiveMembership,
  getTeamRosterLock,
  hasTeamRegistrationConflict,
  isTeamLeader,
} from "@/lib/teams/guards";
import { attachTeamActionResource, reserveTeamAction } from "@/lib/teams/idempotency";
import { normalizeTeamInvitationRow } from "@/lib/teams/types";
import { validateIdempotencyToken, validateInviteAction } from "@/lib/teams/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
  requireSameOriginMutation,
} from "@/app/api/mathlete/teams/_shared";

interface RouteContext {
  params: Promise<{ inviteId: string }>;
}

type InvitationRow = {
  id: string;
  team_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { inviteId } = await context.params;

  const payload = (await request.json().catch(() => null)) as
    | { action?: string; requestIdempotencyToken?: string }
    | null;

  const actionValidation = validateInviteAction(payload?.action);
  if (!actionValidation.ok || !actionValidation.value) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      { errors: actionValidation.errors },
    );
  }

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
    return jsonError("service_unavailable", "Invite service is unavailable.", 503);
  }

  const { actor } = auth;

  try {
    const { data: inviteRow, error: inviteError } = await admin
      .from("team_invitations")
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .eq("id", inviteId)
      .maybeSingle<InvitationRow>();

    if (inviteError) {
      return jsonDatabaseError(inviteError);
    }

    if (!inviteRow || inviteRow.invitee_id !== actor.userId) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    if (inviteRow.status !== "pending") {
      return jsonOk({
        code: "already_responded",
        invite: normalizeTeamInvitationRow(inviteRow),
      });
    }

    const action = actionValidation.value;
    const actionType = action === "accept" ? "invite_accept" : "invite_decline";

    const reservation = await reserveTeamAction(admin, {
      teamId: inviteRow.team_id,
      actorId: actor.userId,
      targetProfileId: actor.userId,
      actionType,
      idempotencyToken: tokenValidation.value,
    });

    if (reservation.resourceId) {
      const { data: replayInvite, error: replayError } = await admin
        .from("team_invitations")
        .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
        .eq("id", inviteId)
        .maybeSingle<InvitationRow>();

      if (replayError) {
        return jsonDatabaseError(replayError);
      }

      return jsonOk({
        code: "already_responded",
        invite: normalizeTeamInvitationRow(replayInvite),
        replayed: true,
      });
    }

    if (action === "accept") {
      const lock = await getTeamRosterLock(admin, inviteRow.team_id);
      if (lock.locked) {
        return jsonError(
          "roster_locked",
          "Team roster changes are locked for an active registration.",
          409,
        );
      }

      const conflict = await hasTeamRegistrationConflict(
        admin,
        inviteRow.team_id,
        actor.userId,
      );

      if (conflict.conflict) {
        return jsonError(
          "registration_conflict",
          "This invite conflicts with an existing registered team.",
          409,
        );
      }

      const { data: membershipRow, error: membershipError } = await admin
        .from("team_memberships")
        .insert({
          team_id: inviteRow.team_id,
          profile_id: actor.userId,
          role: "member",
          is_active: true,
        })
        .select("id")
        .single<{ id: string }>();

      if (membershipError && membershipError.code !== "23505") {
        return jsonDatabaseError(membershipError);
      }

      const { data: updatedInvite, error: updateError } = await admin
        .from("team_invitations")
        .update({
          status: "accepted",
          responded_at: new Date().toISOString(),
        })
        .eq("id", inviteId)
        .eq("status", "pending")
        .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
        .maybeSingle<InvitationRow>();

      if (updateError) {
        return jsonDatabaseError(updateError);
      }

      if (!updatedInvite) {
        const { data: currentInvite, error: currentError } = await admin
          .from("team_invitations")
          .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
          .eq("id", inviteId)
          .maybeSingle<InvitationRow>();

        if (currentError) {
          return jsonDatabaseError(currentError);
        }

        return jsonOk({
          code: "already_responded",
          invite: normalizeTeamInvitationRow(currentInvite ?? inviteRow),
        });
      }

      const invite = normalizeTeamInvitationRow(updatedInvite ?? inviteRow);
      if (!invite) {
        return jsonError("operation_failed", "Invite response failed.", 500);
      }

      if (membershipRow?.id) {
        await attachTeamActionResource(admin, reservation.entryId, membershipRow.id);
      }

      await dispatchTeamNotification({
        event: "team_invite_accepted",
        eventIdentityKey: `team_invite_accepted:${invite.id}`,
        recipientId: invite.inviterId,
        actorId: actor.userId,
        teamId: invite.teamId,
        inviteId: invite.id,
        metadata: {
          inviteeId: actor.userId,
        },
      });

      return jsonOk({
        code: "accepted",
        invite,
      });
    }

    const { data: declinedInvite, error: declineError } = await admin
      .from("team_invitations")
      .update({
        status: "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .eq("status", "pending")
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .maybeSingle<InvitationRow>();

    if (declineError) {
      return jsonDatabaseError(declineError);
    }

    if (!declinedInvite) {
      const { data: currentInvite, error: currentError } = await admin
        .from("team_invitations")
        .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
        .eq("id", inviteId)
        .maybeSingle<InvitationRow>();

      if (currentError) {
        return jsonDatabaseError(currentError);
      }

      return jsonOk({
        code: "already_responded",
        invite: normalizeTeamInvitationRow(currentInvite ?? inviteRow),
      });
    }

    const invite = normalizeTeamInvitationRow(declinedInvite ?? inviteRow);
    if (!invite) {
      return jsonError("operation_failed", "Invite response failed.", 500);
    }

    await attachTeamActionResource(admin, reservation.entryId, invite.id);

    await dispatchTeamNotification({
      event: "team_invite_declined",
      eventIdentityKey: `team_invite_declined:${invite.id}`,
      recipientId: invite.inviterId,
      actorId: actor.userId,
      teamId: invite.teamId,
      inviteId: invite.id,
      metadata: {
        inviteeId: actor.userId,
      },
    });

    return jsonOk({
      code: "declined",
      invite,
    });
  } catch (error) {
    return jsonDatabaseError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { inviteId } = await context.params;

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
    return jsonError("service_unavailable", "Invite service is unavailable.", 503);
  }

  const { actor } = auth;

  try {
    const { data: inviteRow, error: inviteError } = await admin
      .from("team_invitations")
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .eq("id", inviteId)
      .maybeSingle<InvitationRow>();

    if (inviteError) {
      return jsonDatabaseError(inviteError);
    }

    if (!inviteRow) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    const membership = await fetchActiveMembership(admin, inviteRow.team_id, actor.userId);
    if (!membership) {
      return jsonError("forbidden", "You do not have permission for this operation.", 403);
    }

    const isLeader = await isTeamLeader(admin, inviteRow.team_id, actor.userId);
    if (!isLeader) {
      return jsonError("forbidden", "Only team leaders can revoke invites.", 403);
    }

    const lock = await getTeamRosterLock(admin, inviteRow.team_id);
    if (lock.locked) {
      return jsonError(
        "roster_locked",
        "Team roster changes are locked for an active registration.",
        409,
      );
    }

    if (inviteRow.status !== "pending") {
      return jsonOk({
        code: "already_responded",
        invite: normalizeTeamInvitationRow(inviteRow),
      });
    }

    await reserveTeamAction(admin, {
      teamId: inviteRow.team_id,
      actorId: actor.userId,
      targetProfileId: inviteRow.invitee_id,
      actionType: "invite_revoke",
      idempotencyToken: tokenValidation.value,
    });

    const { data: revokedInvite, error: revokeError } = await admin
      .from("team_invitations")
      .update({
        status: "revoked",
        responded_at: new Date().toISOString(),
      })
      .eq("id", inviteId)
      .eq("status", "pending")
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .maybeSingle<InvitationRow>();

    if (revokeError) {
      return jsonDatabaseError(revokeError);
    }

    return jsonOk({
      code: "revoked",
      invite: normalizeTeamInvitationRow(revokedInvite ?? inviteRow),
    });
  } catch (error) {
    return jsonDatabaseError(error);
  }
}
