import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeTeamInvitationRow,
  normalizeTeamMemberProfile,
  normalizeTeamRow,
} from "@/lib/teams/types";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
} from "@/app/api/mathlete/teams/_shared";

export async function GET() {
  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonError("service_unavailable", "Invite service is unavailable.", 503);
  }

  const { actor } = auth;

  const { data: inviteRows, error: inviteError } = await admin
    .from("team_invitations")
    .select("id, team_id, inviter_id, invitee_id, status, created_at, responded_at")
    .eq("invitee_id", actor.userId)
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

  const teamIds = [...new Set(invites.map((invite) => invite.teamId))];
  const inviterIds = [...new Set(invites.map((invite) => invite.inviterId))];

  const { data: teamRows, error: teamError } = await admin
    .from("teams")
    .select("id, name, team_code, created_by, is_archived, created_at, updated_at")
    .in("id", teamIds);

  if (teamError) {
    return jsonDatabaseError(teamError);
  }

  const { data: profileRows, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, school, grade_level")
    .in("id", inviterIds);

  if (profileError) {
    return jsonDatabaseError(profileError);
  }

  const teamMap = new Map(
    (teamRows ?? [])
      .map((row) => normalizeTeamRow(row))
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((team) => [team.id, team]),
  );

  const inviterMap = new Map(
    (profileRows ?? [])
      .map((row) => normalizeTeamMemberProfile(row))
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((profile) => [profile.id, profile]),
  );

  const enrichedInvites = invites.map((invite) => ({
    ...invite,
    team: teamMap.get(invite.teamId) ?? null,
    inviter: inviterMap.get(invite.inviterId) ?? null,
  }));

  return jsonOk({
    code: "ok",
    invites: enrichedInvites,
  });
}
