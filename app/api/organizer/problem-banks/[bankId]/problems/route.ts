import {
  canMutateBank,
  canViewBank,
  normalizeProblemRow,
  toProblemDatabaseColumns,
  validateProblemWriteInput,
} from "@/lib/problem-bank/api-helpers";
import { normalizeProblemDifficulty, normalizeProblemType } from "@/lib/problem-bank/normalization";
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

const PROBLEM_SELECT_COLUMNS =
  "id, bank_id, type, difficulty, tags, content_latex, content, options_json, options, answer_key_json, answers, explanation_latex, authoring_notes, image_path, image_url, created_at, updated_at";

export async function GET(request: Request, context: RouteContext) {
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

  const { data, error } = await supabase
    .from("problems")
    .select(PROBLEM_SELECT_COLUMNS)
    .eq("bank_id", bankId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (error) {
    return jsonDatabaseError(error);
  }

  const searchParams = new URL(request.url).searchParams;
  const typeFilter = normalizeProblemType(searchParams.get("type") ?? "");
  const difficultyFilter = normalizeProblemDifficulty(searchParams.get("difficulty") ?? "");
  const tagFilter = (searchParams.get("tag") ?? "").trim().toLowerCase();

  const problems = (data ?? [])
    .map((row) => normalizeProblemRow(row))
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .filter((problem) => {
      if (typeFilter && problem.type !== typeFilter) {
        return false;
      }

      if (difficultyFilter && problem.difficulty !== difficultyFilter) {
        return false;
      }

      if (!tagFilter) {
        return true;
      }

      return problem.tags.some((tag) => tag.toLowerCase().includes(tagFilter));
    });

  return jsonOk({
    code: "ok",
    problems,
  });
}

export async function POST(request: Request, context: RouteContext) {
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

  if (!canMutateBank(actor, bankResult.bank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
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
      }
    | null;

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
    .insert({
      bank_id: bankId,
      is_deleted: false,
      ...toProblemDatabaseColumns(validation.value),
    })
    .select(PROBLEM_SELECT_COLUMNS)
    .single();

  if (error) {
    return jsonDatabaseError(error);
  }

  const problem = normalizeProblemRow(data);
  if (!problem) {
    return jsonError("operation_failed", "Problem could not be created.", 500);
  }

  return jsonOk(
    {
      code: "created",
      problem,
    },
    201,
  );
}
