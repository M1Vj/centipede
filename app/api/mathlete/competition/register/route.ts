import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";
import { registrationMachineCodeMessage } from "@/lib/registrations/messages";
import {
  validateCompetitionId,
  validateIdempotencyToken,
  validateTeamId,
} from "@/lib/registrations/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
  requireSameOriginMutation,
} from "@/app/api/mathlete/competition/_shared";

type RegisterPayload = {
  competitionId?: string;
  teamId?: string | null;
  requestIdempotencyToken?: string;
};

type RegisterRpcRow = {
  machine_code?: string | null;
  registration_id?: string | null;
  status?: string | null;
  status_reason?: string | null;
  entry_snapshot_json?: Record<string, unknown> | null;
};

function normalizeRpcRow(data: unknown): RegisterRpcRow {
  if (!data) {
    return {};
  }

  if (Array.isArray(data)) {
    return (data[0] as RegisterRpcRow) ?? {};
  }

  return data as RegisterRpcRow;
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

  const payload = (await request.json().catch(() => null)) as RegisterPayload | null;

  const competitionValidation = validateCompetitionId(payload?.competitionId);
  const teamValidation = validateTeamId(payload?.teamId);
  const tokenValidation = validateIdempotencyToken(payload?.requestIdempotencyToken);

  if (!competitionValidation.ok || !teamValidation.ok || !tokenValidation.ok) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          ...competitionValidation.errors,
          ...teamValidation.errors,
          ...tokenValidation.errors,
        ],
      },
    );
  }

  const { supabase, actor } = auth;
  const competitionId = competitionValidation.value ?? "";
  const teamId = teamValidation.value;
  const requestIdempotencyToken = tokenValidation.value ?? "";

  if (!competitionId || !requestIdempotencyToken) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  const { data, error } = await supabase.rpc("register_for_competition", {
    p_competition_id: competitionId,
    p_team_id: teamId,
    p_request_idempotency_token: requestIdempotencyToken,
  });

  if (error) {
    return jsonDatabaseError(error, "Registration failed.");
  }

  const row = normalizeRpcRow(data);
  const machineCode = row.machine_code ?? "operation_failed";
  const { tone, message } = registrationMachineCodeMessage(machineCode);

  if (machineCode === "ok" && row.registration_id) {
    await dispatchCompetitionNotification({
      event: "competition_registration_confirmed",
      eventIdentityKey: `competition_registration_confirmed:${competitionId}:${row.registration_id}`,
      recipientId: actor.userId,
      actorId: actor.userId,
      competitionId,
      registrationId: row.registration_id,
      metadata: {
        teamId,
      },
    });
  }

  return jsonOk({
    code: machineCode,
    tone,
    message,
    registrationId: row.registration_id ?? null,
    status: row.status ?? null,
    statusReason: row.status_reason ?? null,
  });
}
