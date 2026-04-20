import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";

export type TeamRosterInvalidationResult = {
  machineCode: "ok" | "not_found" | "deferred_owner_schema" | "service_unavailable";
  registrationId: string | null;
};

type SupabaseError = {
  code?: string | null;
  message?: string | null;
};

function isMissingRegistrationSchema(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = error.message?.toLowerCase() ?? "";

  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("competition_registrations") ||
    message.includes("status_reason")
  );
}

export async function markTeamRegistrationIneligible(input: {
  teamId: string;
  competitionId: string;
  statusReason: string;
  requestIdempotencyToken: string;
  actorId?: string | null;
  recipientIds?: string[];
}): Promise<TeamRosterInvalidationResult> {
  const admin = createAdminClient();
  if (!admin) {
    return { machineCode: "service_unavailable", registrationId: null };
  }

  try {
    const { data, error } = await admin
      .from("competition_registrations")
      .update({
        status: "ineligible",
        status_reason: input.statusReason,
      })
      .eq("team_id", input.teamId)
      .eq("competition_id", input.competitionId)
      .eq("status", "registered")
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      if (isMissingRegistrationSchema(error)) {
        return { machineCode: "deferred_owner_schema", registrationId: null };
      }

      throw error;
    }

    if (!data?.id) {
      return { machineCode: "not_found", registrationId: null };
    }

    const recipients = input.recipientIds ?? [];
    if (recipients.length > 0) {
      await Promise.all(
        recipients.map((recipientId) =>
          dispatchTeamNotification({
            event: "team_roster_invalidated",
            eventIdentityKey: `team_roster_invalidated:${input.competitionId}:${input.teamId}`,
            recipientId,
            actorId: input.actorId ?? null,
            teamId: input.teamId,
            inviteId: null,
            metadata: {
              competitionId: input.competitionId,
              statusReason: input.statusReason,
              requestIdempotencyToken: input.requestIdempotencyToken,
            },
          }),
        ),
      );
    }

    return { machineCode: "ok", registrationId: data.id };
  } catch (error) {
    if (isMissingRegistrationSchema(error as SupabaseError)) {
      return { machineCode: "deferred_owner_schema", registrationId: null };
    }

    throw error;
  }
}
