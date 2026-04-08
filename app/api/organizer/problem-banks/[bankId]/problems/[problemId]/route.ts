import {
  canMutateBank,
  canViewBank,
  normalizeExpectedUpdatedAt,
  normalizeProblemRow,
  toProblemDatabaseColumns,
  validateProblemWriteInput,
} from "@/lib/problem-bank/api-helpers";
import {
  createProblemAssetSignedUrl,
  fetchProblemBank,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireSameOriginMutation,
  requireProblemBankActor,
} from "@/app/api/organizer/problem-banks/_shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
  params: Promise<{ bankId: string; problemId: string }>;
}

const PROBLEM_SELECT_COLUMNS =
  "id, bank_id, type, difficulty, tags, content_latex, content, options_json, options, answer_key_json, answers, explanation_latex, authoring_notes, image_path, image_url, created_at, updated_at";

async function fetchProblem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bankId: string,
  problemId: string,
) {
  const { data, error } = await supabase
    .from("problems")
    .select(PROBLEM_SELECT_COLUMNS)
    .eq("bank_id", bankId)
    .eq("id", problemId)
    .maybeSingle();

  if (error) {
    return {
      response: jsonDatabaseError(error),
    } as const;
  }

  const problem = normalizeProblemRow(data);
  if (!problem) {
    return {
      response: jsonError("not_found", "Requested resource was not found.", 404),
    } as const;
  }

  return { problem } as const;
}

export async function GET(_: Request, context: RouteContext) {
  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const { bankId, problemId } = await context.params;
  const { actor, supabase } = auth;

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canViewBank(actor, bankResult.bank)) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const problemResult = await fetchProblem(supabase, bankId, problemId);
  if ("response" in problemResult) {
    return problemResult.response;
  }

  if (problemResult.problem.isDeleted) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const imageUrl = await createProblemAssetSignedUrl(supabase, problemResult.problem.imagePath);

  return jsonOk({
    code: "ok",
    problem: {
      ...problemResult.problem,
      imageUrl,
    },
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

  const { bankId, problemId } = await context.params;
  const { actor, supabase } = auth;

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canMutateBank(actor, bankResult.bank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const currentProblemResult = await fetchProblem(supabase, bankId, problemId);
  if ("response" in currentProblemResult) {
    return currentProblemResult.response;
  }

  const currentProblem = currentProblemResult.problem;
  if (currentProblem.isDeleted) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const payload = (await request.json().catch(() => null)) as
    | {
        type?: unknown;
        difficulty?: unknown;
        tags?: unknown;
        contentLatex?: unknown;
        explanationLatex?: unknown;
        authoringNotes?: unknown;
        imagePath?: unknown;
        options?: unknown;
        answerKey?: unknown;
        expectedUpdatedAt?: unknown;
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

  const validation = validateProblemWriteInput({
    type: payload?.type,
    difficulty: payload?.difficulty,
    tags: payload?.tags,
    contentLatex: payload?.contentLatex,
    explanationLatex: payload?.explanationLatex,
    authoringNotes: payload?.authoringNotes,
    imagePath: payload?.imagePath,
    options: payload?.options,
    answerKey: payload?.answerKey,
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
    .from("problems")
    .update({
      ...toProblemDatabaseColumns(validation.value),
    })
    .eq("bank_id", bankId)
    .eq("id", problemId)
    .eq("updated_at", expectedUpdatedAt)
    .select(PROBLEM_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    return jsonDatabaseError(error);
  }

  if (!data) {
    const staleCheck = await fetchProblem(supabase, bankId, problemId);
    if ("response" in staleCheck) {
      return staleCheck.response;
    }

    return jsonError(
      "write_conflict",
      "This record was updated elsewhere. Refresh and retry.",
      409,
      {
        problem: staleCheck.problem,
      },
    );
  }

  const problem = normalizeProblemRow(data);
  if (!problem) {
    return jsonError("operation_failed", "Problem update could not be completed.", 500);
  }

  const imageUrl = await createProblemAssetSignedUrl(supabase, problem.imagePath);

  return jsonOk({
    code: "updated",
    problem: {
      ...problem,
      imageUrl,
    },
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

  const { bankId, problemId } = await context.params;
  const { actor, supabase } = auth;

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canMutateBank(actor, bankResult.bank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const currentProblemResult = await fetchProblem(supabase, bankId, problemId);
  if ("response" in currentProblemResult) {
    return currentProblemResult.response;
  }

  const currentProblem = currentProblemResult.problem;
  if (currentProblem.isDeleted) {
    return jsonError("not_found", "Requested resource was not found.", 404);
  }

  const payload = (await request.json().catch(() => null)) as
    | { expectedUpdatedAt?: unknown }
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

  const mutationClient = createAdminClient() ?? supabase;

  const { error, count } = await mutationClient
    .from("problems")
    .update({ is_deleted: true }, { count: "exact" })
    .eq("bank_id", bankId)
    .eq("id", problemId)
    .eq("updated_at", expectedUpdatedAt);

  if (error) {
    return jsonDatabaseError(error);
  }

  if (!count) {
    const staleCheck = await fetchProblem(supabase, bankId, problemId);
    if ("response" in staleCheck) {
      return staleCheck.response;
    }

    return jsonError(
      "write_conflict",
      "This record was updated elsewhere. Refresh and retry.",
      409,
      {
        problem: staleCheck.problem,
      },
    );
  }

  return jsonOk({
    code: "deleted",
    problem: {
      ...currentProblem,
      isDeleted: true,
    },
  });
}
