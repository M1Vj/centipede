import { createAdminClient } from "@/lib/supabase/admin";
import { generateTeamCode } from "@/lib/teams/codes";
import { normalizeTeamMembershipRow, normalizeTeamRow } from "@/lib/teams/types";
import { validateTeamNameInput } from "@/lib/teams/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
  requireSameOriginMutation,
} from "@/app/api/mathlete/teams/_shared";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

function isTeamCodeConflict(error: SupabaseError) {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("teams_team_code_uq") || message.includes("team_code");
}

function isTeamNameConflict(error: SupabaseError) {
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return message.includes("teams_name_lower_uq") || message.includes("name");
}

export async function GET() {
  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, actor } = auth;

  const { data: membershipRows, error: membershipError } = await supabase
    .from("team_memberships")
    .select("id, team_id, profile_id, role, joined_at, left_at, is_active")
    .eq("profile_id", actor.userId)
    .eq("is_active", true);

  if (membershipError) {
    return jsonDatabaseError(membershipError);
  }

  const memberships = (membershipRows ?? [])
    .map((row) => normalizeTeamMembershipRow(row))
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (memberships.length === 0) {
    return jsonOk({
      code: "ok",
      teams: [],
    });
  }

  const teamIds = memberships.map((member) => member.teamId);

  const { data: teamRows, error: teamError } = await supabase
    .from("teams")
    .select("id, name, team_code, created_by, is_archived, created_at, updated_at")
    .in("id", teamIds);

  if (teamError) {
    return jsonDatabaseError(teamError);
  }

  const teamMap = new Map(
    (teamRows ?? [])
      .map((row) => normalizeTeamRow(row))
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map((team) => [team.id, team]),
  );

  const teams = memberships
    .map((membership) => {
      const team = teamMap.get(membership.teamId);
      if (!team) {
        return null;
      }

      return {
        ...team,
        membership: {
          role: membership.role,
          joinedAt: membership.joinedAt,
          isLeader: membership.role === "leader",
        },
      };
    })
    .filter((team): team is NonNullable<typeof team> => team !== null);

  return jsonOk({
    code: "ok",
    teams,
  });
}

export async function POST(request: Request) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireMathleteActor();
  if ("response" in auth) {
    return auth.response;
  }

  const payload = (await request.json().catch(() => null)) as
    | { name?: string }
    | null;

  const validation = validateTeamNameInput(payload?.name);
  if (!validation.ok || !validation.value) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      { errors: validation.errors },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return jsonError(
      "service_unavailable",
      "Team creation is temporarily unavailable.",
      503,
    );
  }

  const { actor } = auth;
  const name = validation.value;

  let createdTeam: ReturnType<typeof normalizeTeamRow> = null;
  let lastError: SupabaseError | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const teamCode = generateTeamCode();
    const { data, error } = await admin
      .from("teams")
      .insert({
        name,
        team_code: teamCode,
        created_by: actor.userId,
        is_archived: false,
      })
      .select("id, name, team_code, created_by, is_archived, created_at, updated_at")
      .single();

    if (!error) {
      createdTeam = normalizeTeamRow(data);
      break;
    }

    lastError = error;

    if (error.code === "23505") {
      if (isTeamCodeConflict(error)) {
        continue;
      }

      if (isTeamNameConflict(error)) {
        return jsonError(
          "duplicate_name",
          "A team with this name already exists.",
          409,
        );
      }
    }

    return jsonDatabaseError(error);
  }

  if (!createdTeam) {
    if (lastError) {
      return jsonDatabaseError(lastError);
    }

    return jsonError("operation_failed", "Team could not be created.", 500);
  }

  return jsonOk(
    {
      code: "created",
      team: createdTeam,
    },
    201,
  );
}
