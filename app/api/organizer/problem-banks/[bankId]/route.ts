import {
  canMutateBank,
  canViewBank,
  normalizeExpectedUpdatedAt,
  normalizeProblemBankRow,
} from "@/lib/problem-bank/api-helpers";
import { validateBankInput } from "@/lib/problem-bank/validation";
import {
  fetchProblemBank,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireSameOriginMutation,
  requireProblemBankActor,
} from "@/app/api/organizer/problem-banks/_shared";

interface RouteContext {
  params: Promise<{ bankId: string }>;
}

const BANK_SELECT_COLUMNS =
  "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at";

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { bankId } = await context.params;
  const { actor, supabase } = auth;

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canViewBank(actor, bankResult.bank)) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  return jsonOk({
    code: "ok",
    bank: bankResult.bank,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { bankId } = await context.params;
  const { actor, supabase } = auth;

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  const currentBank = bankResult.bank;
  if (!canMutateBank(actor, currentBank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        name?: string;
        description?: string;
        expectedUpdatedAt?: string;
        isVisibleToOrganizers?: boolean;
      }
    | null;

  const expectedUpdatedAt = normalizeExpectedUpdatedAt(payload?.expectedUpdatedAt);
  if (!expectedUpdatedAt) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "expectedUpdatedAt",
            reason: "expectedUpdatedAt is required.",
          },
        ],
      },
    );
  }

  const validation = validateBankInput({
    name: payload?.name ?? currentBank.name,
    description: payload?.description ?? currentBank.description,
  });

  if (!validation.ok || !validation.value) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      { errors: validation.errors },
    );
  }

  const updatePayload: Record<string, unknown> = {
    name: validation.value.name,
    description: validation.value.description,
  };

  if (actor.role === "admin" && currentBank.isDefaultBank) {
    if (typeof payload?.isVisibleToOrganizers === "boolean") {
      updatePayload.is_visible_to_organizers = payload.isVisibleToOrganizers;
    }
  }

  const { data, error } = await supabase
    .from("problem_banks")
    .update(updatePayload)
    .eq("id", bankId)
    .eq("updated_at", expectedUpdatedAt)
    .select(BANK_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return jsonError("duplicate_name", "A bank with this name already exists.", 409);
    }

    return jsonDatabaseError(error);
  }

  if (!data) {
    const { data: staleCheck, error: staleCheckError } = await supabase
      .from("problem_banks")
      .select(BANK_SELECT_COLUMNS)
      .eq("id", bankId)
      .maybeSingle();

    if (staleCheckError) {
      return jsonDatabaseError(staleCheckError);
    }

    const staleBank = normalizeProblemBankRow(staleCheck);
    if (!staleBank) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    return jsonError(
      "write_conflict",
      "This record was updated elsewhere. Refresh and retry.",
      409,
      {
        bank: staleBank,
      },
    );
  }

  const bank = normalizeProblemBankRow(data);
  if (!bank) {
    return jsonError("operation_failed", "Bank update could not be completed.", 500);
  }

  return jsonOk({
    code: "updated",
    bank,
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { bankId } = await context.params;
  const { actor, supabase } = auth;

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  const currentBank = bankResult.bank;
  if (!canMutateBank(actor, currentBank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const payload = (await request.json().catch(() => null)) as
    | { expectedUpdatedAt?: string }
    | null;

  const expectedUpdatedAt = normalizeExpectedUpdatedAt(payload?.expectedUpdatedAt);
  if (!expectedUpdatedAt) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "expectedUpdatedAt",
            reason: "expectedUpdatedAt is required.",
          },
        ],
      },
    );
  }

  const { error, count } = await supabase
    .from("problem_banks")
    .update({ is_deleted: true }, { count: "exact" })
    .eq("id", bankId)
    .eq("updated_at", expectedUpdatedAt);

  if (error) {
    return jsonDatabaseError(error);
  }

  if (!count) {
    const { data: staleCheck, error: staleCheckError } = await supabase
      .from("problem_banks")
      .select(BANK_SELECT_COLUMNS)
      .eq("id", bankId)
      .maybeSingle();

    if (staleCheckError) {
      return jsonDatabaseError(staleCheckError);
    }

    const staleBank = normalizeProblemBankRow(staleCheck);
    if (!staleBank) {
      return jsonError("not_found", "Requested resource was not found.", 404);
    }

    return jsonError(
      "write_conflict",
      "This record was updated elsewhere. Refresh and retry.",
      409,
      {
        bank: staleBank,
      },
    );
  }

  return jsonOk({
    code: "deleted",
    bank: {
      ...currentBank,
      isDeleted: true,
    },
  });
}
