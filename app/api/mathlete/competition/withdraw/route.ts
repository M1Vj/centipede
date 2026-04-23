import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";
import { withdrawalMachineCodeMessage } from "@/lib/registrations/messages";
import {
  validateIdempotencyToken,
  validateRegistrationId,
  validateStatusReason,
} from "@/lib/registrations/validation";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireMathleteActor,
  requireSameOriginMutation,
} from "@/app/api/mathlete/competition/_shared";

type WithdrawPayload = {
  registrationId?: string;
  competitionId?: string;
  statusReason?: string;
  requestIdempotencyToken?: string;
};

type WithdrawRpcRow = {
  machine_code?: string | null;
  registration_id?: string | null;
  status?: string | null;
  status_reason?: string | null;
};

function normalizeRpcRow(data: unknown): WithdrawRpcRow {
  if (!data) {
    return {};
  }

  if (Array.isArray(data)) {
    return (data[0] as WithdrawRpcRow) ?? {};
  }

  return data as WithdrawRpcRow;
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

  const payload = (await request.json().catch(() => null)) as WithdrawPayload | null;

  const registrationValidation = validateRegistrationId(payload?.registrationId);
  const reasonValidation = validateStatusReason(payload?.statusReason);
  const tokenValidation = validateIdempotencyToken(payload?.requestIdempotencyToken);

  if (!registrationValidation.ok || !reasonValidation.ok || !tokenValidation.ok) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          ...registrationValidation.errors,
          ...reasonValidation.errors,
          ...tokenValidation.errors,
        ],
      },
    );
  }

  const { supabase, actor } = auth;

  const { data, error } = await supabase.rpc("withdraw_registration", {
    p_registration_id: registrationValidation.value,
    p_status_reason: reasonValidation.value,
    p_request_idempotency_token: tokenValidation.value,
  });

  if (error) {
    return jsonDatabaseError(error, "Withdrawal failed.");
  }

  const row = normalizeRpcRow(data);
  const machineCode = row.machine_code ?? "operation_failed";
  const { tone, message } = withdrawalMachineCodeMessage(machineCode);
  const competitionId = typeof payload?.competitionId === "string" ? payload?.competitionId : null;

  if (machineCode === "ok" && row.registration_id && competitionId) {
    await dispatchCompetitionNotification({
      event: "competition_registration_withdrawn",
      eventIdentityKey: `competition_registration_withdrawn:${competitionId}:${row.registration_id}`,
      recipientId: actor.userId,
      actorId: actor.userId,
      competitionId,
      registrationId: row.registration_id,
      metadata: {
        statusReason: reasonValidation.value,
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
