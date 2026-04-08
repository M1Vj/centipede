import { validateBankInput } from "@/lib/problem-bank/validation";
import { normalizeProblemBankRow } from "@/lib/problem-bank/api-helpers";
import {
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireSameOriginMutation,
  requireProblemBankActor,
} from "@/app/api/organizer/problem-banks/_shared";

export async function GET() {
  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, actor } = auth;

  const { data, error } = await supabase
    .from("problem_banks")
    .select(
      "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at",
    )
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonDatabaseError(error);
  }

  const banks = (data ?? [])
    .map((row) => normalizeProblemBankRow(row))
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((bank) => {
      if (actor.role === "admin") {
        return true;
      }

      return (
        bank.organizerId === actor.userId ||
        (bank.isDefaultBank && bank.isVisibleToOrganizers)
      );
    });

  const ownBanks = banks.filter((bank) => bank.organizerId === actor.userId && !bank.isDefaultBank);
  const defaultBanks = banks.filter((bank) => bank.isDefaultBank);

  return jsonOk({
    code: "ok",
    banks,
    ownBanks,
    defaultBanks,
  });
}

export async function POST(request: Request) {
  const sameOriginError = requireSameOriginMutation(request);
  if (sameOriginError) {
    return sameOriginError;
  }

  const auth = await requireProblemBankActor({
    allowAdmin: false,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { supabase, actor } = auth;

  const payload = (await request.json().catch(() => null)) as
    | { name?: string; description?: string }
    | null;

  const validation = validateBankInput({
    name: payload?.name,
    description: payload?.description,
  });

  if (!validation.ok || !validation.value) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      { errors: validation.errors },
    );
  }

  const { data, error } = await supabase
    .from("problem_banks")
    .insert({
      organizer_id: actor.userId,
      name: validation.value.name,
      description: validation.value.description,
      is_deleted: false,
      is_default_bank: false,
      is_visible_to_organizers: false,
    })
    .select(
      "id, organizer_id, name, description, is_default_bank, is_visible_to_organizers, is_deleted, created_at, updated_at",
    )
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError("duplicate_name", "A bank with this name already exists.", 409);
    }

    return jsonDatabaseError(error);
  }

  const bank = normalizeProblemBankRow(data);
  if (!bank) {
    return jsonError("operation_failed", "Bank could not be created.", 500);
  }

  return jsonOk(
    {
      code: "created",
      bank,
    },
    201,
  );
}
