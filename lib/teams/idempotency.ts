import type { SupabaseClient } from "@supabase/supabase-js";

export type TeamActionIdempotencyRow = {
  id: string;
  resource_id: string | null;
};

export type TeamActionReservation = {
  entryId: string;
  resourceId: string | null;
  isReplay: boolean;
};

export async function reserveTeamAction(
  admin: SupabaseClient,
  input: {
    teamId: string;
    actorId: string;
    targetProfileId?: string | null;
    actionType: string;
    idempotencyToken: string;
  },
): Promise<TeamActionReservation> {
  const { data, error } = await admin
    .from("team_action_idempotency")
    .insert({
      team_id: input.teamId,
      actor_id: input.actorId,
      target_profile_id: input.targetProfileId ?? null,
      action_type: input.actionType,
      idempotency_token: input.idempotencyToken,
    })
    .select("id, resource_id")
    .single<TeamActionIdempotencyRow>();

  if (!error && data) {
    return {
      entryId: data.id,
      resourceId: data.resource_id ?? null,
      isReplay: false,
    };
  }

  if (error && error.code !== "23505") {
    throw error;
  }

  const { data: existing, error: existingError } = await admin
    .from("team_action_idempotency")
    .select("id, resource_id")
    .eq("team_id", input.teamId)
    .eq("actor_id", input.actorId)
    .eq("action_type", input.actionType)
    .eq("idempotency_token", input.idempotencyToken)
    .maybeSingle<TeamActionIdempotencyRow>();

  if (existingError) {
    throw existingError;
  }

  if (!existing) {
    return {
      entryId: "",
      resourceId: null,
      isReplay: true,
    };
  }

  return {
    entryId: existing.id,
    resourceId: existing.resource_id ?? null,
    isReplay: true,
  };
}

export async function attachTeamActionResource(
  admin: SupabaseClient,
  entryId: string,
  resourceId: string,
) {
  if (!entryId || !resourceId) {
    return;
  }

  await admin
    .from("team_action_idempotency")
    .update({ resource_id: resourceId })
    .eq("id", entryId)
    .is("resource_id", null);
}
