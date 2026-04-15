import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeTeamMemberProfile,
  normalizeTeamMembershipRow,
  normalizeTeamRow,
} from "@/lib/teams/types";
import { isUuid } from "@/lib/teams/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
} from "@/app/api/mathlete/teams/_shared";

interface RouteContext {
  params: Promise<{ teamId: string }>;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  school: string | null;
  grade_level: string | null;
};

type MemberRecord = NonNullable<ReturnType<typeof normalizeTeamMembershipRow>>;
type MemberProfile = ReturnType<typeof normalizeTeamMemberProfile>;

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { teamId } = await context.params;
  if (!isUuid(teamId)) {
    return jsonError("invalid_input", "Request payload is invalid.", 400);
  }
  const { supabase, actor } = auth;

  const { data: membershipRow, error: membershipError } = await supabase
    .from("team_memberships")
    .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
    .eq("team_id", teamId)
    .eq("profile_id", actor.userId)
    .eq("is_active", true)
    .maybeSingle();

  if (membershipError) {
    return jsonDatabaseError(membershipError);
  }

  const membership = normalizeTeamMembershipRow(membershipRow);
  if (!membership) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const { data: teamRow, error: teamError } = await supabase
    .from("teams")
    .select("id, name, team_code, created_by, is_archived, created_at, updated_at")
    .eq("id", teamId)
    .maybeSingle();

  if (teamError) {
    return jsonDatabaseError(teamError);
  }

  const team = normalizeTeamRow(teamRow);
  if (!team) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const admin = createAdminClient();
  let members: Array<MemberRecord & { profile: MemberProfile | null }> = [];

  if (admin) {
    const { data: memberRows, error: memberError } = await admin
      .from("team_memberships")
      .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("joined_at", { ascending: true });

    if (memberError) {
      return jsonDatabaseError(memberError);
    }

    const memberList = (memberRows ?? [])
      .map((row) => normalizeTeamMembershipRow(row))
      .filter((row): row is NonNullable<typeof row> => row !== null);

    const profileIds = memberList.map((row) => row.profileId);

    const { data: profileRows, error: profileError } = await admin
      .from("profiles")
      .select("id, full_name, school, grade_level")
      .in("id", profileIds)
      .returns<ProfileRow[]>();

    if (profileError) {
      return jsonDatabaseError(profileError);
    }

    const profileMap = new Map(
      (profileRows ?? [])
        .map((row) => normalizeTeamMemberProfile(row))
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .map((profile) => [profile.id, profile]),
    );

    members = memberList.map((row) => ({
      ...row,
      profile: profileMap.get(row.profileId) ?? null,
    }));
  } else {
    const { data: memberRows, error: memberError } = await supabase
      .from("team_memberships")
      .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
      .eq("team_id", teamId)
      .eq("is_active", true)
      .order("joined_at", { ascending: true });

    if (memberError) {
      return jsonDatabaseError(memberError);
    }

    members = (memberRows ?? [])
      .map((row) => normalizeTeamMembershipRow(row))
      .filter((row): row is MemberRecord => row !== null)
      .map((row) => ({ ...row, profile: null }));
  }

  return jsonOk({
    code: "ok",
    team,
    membership,
    members,
  });
}
