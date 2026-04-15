import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";
import {
  fetchActiveMembership,
  fetchTeamById,
  getTeamRosterLock,
  isTeamLeader,
} from "@/lib/teams/guards";
import { attachTeamActionResource, reserveTeamAction } from "@/lib/teams/idempotency";
import { normalizeTeamInvitationRow, normalizeTeamMemberProfile } from "@/lib/teams/types";
import { isUuid, validateIdempotencyToken } from "@/lib/teams/validation";
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

type InviteeRow = {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean | null;
};

type InvitationRow = {
  id: string;
  team_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string;
  responded_at: string | null;
};

type InviteeProfileRow = {
  id: string;
  full_name: string | null;
  school: string | null;
  grade_level: string | null;
};

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonError("service_unavailable", "Invite service is unavailable.", 503);
  }

  const { teamId } = await context.params;
  const { actor } = auth;

  try {
    const team = await fetchTeamById(admin, teamId);
    if (!team || team.is_archived) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    const membership = await fetchActiveMembership(admin, teamId, actor.userId);
    if (!membership) {
      return jsonError("forbidden", "You do not have permission for this operation.", 403);
    }

    const isLeader = await isTeamLeader(admin, teamId, actor.userId);
    if (!isLeader) {
      return jsonError("forbidden", "Only team leaders can view pending invites.", 403);
    }

    const { data: inviteRows, error: inviteError } = await admin
      .from("team_invitations")
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .eq("team_id", teamId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (inviteError) {
      return jsonDatabaseError(inviteError);
    }

    const invites = (inviteRows ?? [])
      .map((row) => normalizeTeamInvitationRow(row))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (invites.length === 0) {
      return jsonOk({
        code: "ok",
        invites: [],
      });
    }

    const inviteeIds = [...new Set(invites.map((invite) => invite.inviteeId))];

    const { data: inviteeRows, error: inviteeError } = await admin
      .from("profiles")
      .select("id, full_name, school, grade_level")
      .in("id", inviteeIds)
      .returns<InviteeProfileRow[]>();

    if (inviteeError) {
      return jsonDatabaseError(inviteeError);
    }

    const inviteeMap = new Map(
      (inviteeRows ?? [])
        .map((row) => normalizeTeamMemberProfile(row))
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .map((profile) => [profile.id, profile]),
    );

    const enrichedInvites = invites.map((invite) => ({
      ...invite,
      invitee: inviteeMap.get(invite.inviteeId) ?? null,
    }));

    return jsonOk({
      code: "ok",
      invites: enrichedInvites,
    });
  } catch (error) {
    return jsonDatabaseError(error);
  }
}

type InviteeResult =
  | { profile: InviteeRow }
  | {
      error: "validation_failed" | "not_found" | "ambiguous_invitee";
      message: string;
    };

async function resolveInvitee(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  input: { inviteeId?: string | null; inviteeHandle?: string | null },
): Promise<InviteeResult> {
  if (input.inviteeId) {
    if (!isUuid(input.inviteeId)) {
      return { error: "validation_failed", message: "Invitee id must be a UUID." };
    }

    const { data, error } = await admin
      .from("profiles")
      .select("id, full_name, role, is_active")
      .eq("id", input.inviteeId)
      .maybeSingle<InviteeRow>();

    if (error) {
      throw error;
    }

    if (!data || data.is_active === false || data.role !== "mathlete") {
      return { error: "not_found", message: "Invitee not found." };
    }

    return { profile: data };
  }

  const handle = (input.inviteeHandle ?? "").trim();
  if (!handle) {
    return { error: "validation_failed", message: "Invitee handle is required." };
  }

  if (/%|_/.test(handle)) {
    return { error: "validation_failed", message: "Invitee handle is invalid." };
  }

  const handleIsEmail = handle.includes("@");
  const normalizedHandle = handleIsEmail ? handle.toLowerCase() : handle;
  const query = admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("role", "mathlete")
    .eq("is_active", true)
    .limit(2);

  const { data, error } = handleIsEmail
    ? await query.eq("email", normalizedHandle)
    : await query.ilike("full_name", normalizedHandle);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return { error: "not_found", message: "Invitee not found." };
  }

  if (data.length > 1) {
    return { error: "ambiguous_invitee", message: "Invitee handle is not unique." };
  }

  return { profile: data[0] };
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
    | {
        inviteeId?: string;
        inviteeHandle?: string;
        requestIdempotencyToken?: string;
      }
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
    const team = await fetchTeamById(admin, teamId);
    if (!team || team.is_archived) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    const membership = await fetchActiveMembership(admin, teamId, actor.userId);
    if (!membership) {
      return jsonError("forbidden", "You do not have permission for this operation.", 403);
    }

    const isLeader = await isTeamLeader(admin, teamId, actor.userId);
    if (!isLeader) {
      return jsonError("forbidden", "Only team leaders can send invites.", 403);
    }

    const lock = await getTeamRosterLock(admin, teamId);
    if (lock.locked) {
      return jsonError(
        "roster_locked",
        "Team roster changes are locked for an active registration.",
        409,
      );
    }

    const inviteeResult = await resolveInvitee(admin, {
      inviteeId: payload?.inviteeId ?? null,
      inviteeHandle: payload?.inviteeHandle ?? null,
    });

    if ("error" in inviteeResult) {
      const status = inviteeResult.error === "not_found" ? 404 : 400;
      return jsonError(inviteeResult.error, inviteeResult.message, status);
    }

    const invitee = inviteeResult.profile;
    if (invitee.id === actor.userId) {
      return jsonError("invalid_invitee", "You cannot invite yourself.", 400);
    }

    const { data: existingMember, error: memberError } = await admin
      .from("team_memberships")
      .select("id")
      .eq("team_id", teamId)
      .eq("profile_id", invitee.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memberError) {
      return jsonDatabaseError(memberError);
    }

    if (existingMember) {
      return jsonError("already_member", "This user is already on the team.", 409);
    }

    const { data: existingInvite, error: inviteError } = await admin
      .from("team_invitations")
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .eq("team_id", teamId)
      .eq("invitee_id", invitee.id)
      .eq("status", "pending")
      .maybeSingle<InvitationRow>();

    if (inviteError) {
      return jsonDatabaseError(inviteError);
    }

    if (existingInvite) {
      const invite = normalizeTeamInvitationRow(existingInvite);
      return jsonOk({
        code: "already_invited",
        invite,
      });
    }

    const reservation = await reserveTeamAction(admin, {
      teamId,
      actorId: actor.userId,
      targetProfileId: invitee.id,
      actionType: "invite_send",
      idempotencyToken: tokenValidation.value,
    });

    if (reservation.resourceId) {
      const { data: replayInvite, error: replayError } = await admin
        .from("team_invitations")
        .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
        .eq("id", reservation.resourceId)
        .maybeSingle<InvitationRow>();

      if (replayError) {
        return jsonDatabaseError(replayError);
      }

      return jsonOk({
        code: "already_invited",
        invite: normalizeTeamInvitationRow(replayInvite),
        replayed: true,
      });
    }

    const { data: inviteRow, error: insertError } = await admin
      .from("team_invitations")
      .insert({
        team_id: teamId,
        inviter_id: actor.userId,
        invitee_id: invitee.id,
        status: "pending",
      })
      .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
      .single<InvitationRow>();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: pendingInvite, error: pendingError } = await admin
          .from("team_invitations")
          .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
          .eq("team_id", teamId)
          .eq("invitee_id", invitee.id)
          .eq("status", "pending")
          .maybeSingle<InvitationRow>();

        if (pendingError) {
          return jsonDatabaseError(pendingError);
        }

        return jsonOk({
          code: "already_invited",
          invite: normalizeTeamInvitationRow(pendingInvite),
        });
      }

      return jsonDatabaseError(insertError);
    }

    const invite = normalizeTeamInvitationRow(inviteRow);
    if (!invite) {
      return jsonError("operation_failed", "Invite could not be created.", 500);
    }

    await attachTeamActionResource(admin, reservation.entryId, invite.id);

    await dispatchTeamNotification({
      event: "team_invite_sent",
      eventIdentityKey: `team_invite_sent:${invite.id}`,
      recipientId: invitee.id,
      actorId: actor.userId,
      teamId,
      inviteId: invite.id,
      metadata: {
        teamName: team.name,
        inviterId: actor.userId,
      },
    });

    return jsonOk(
      {
        code: "invited",
        invite,
      },
      201,
    );
  } catch (error) {
    return jsonDatabaseError(error);
  }
}
