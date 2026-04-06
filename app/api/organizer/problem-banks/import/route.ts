import {
  canMutateBank,
  toProblemDatabaseColumns,
  type ValidatedProblemWriteInput,
} from "@/lib/problem-bank/api-helpers";
import { parseProblemBankImportCsv } from "@/lib/problem-bank/import-parser";
import { getProblemBankImportTemplateCsv } from "@/lib/problem-bank/import-template";
import type { ProblemImportParseError, ProblemImportRow } from "@/lib/problem-bank/types";
import { createClient } from "@/lib/supabase/server";
import {
  fetchProblemBank,
  jsonDatabaseError,
  jsonError,
  jsonOk,
  requireSameOriginMutation,
  requireProblemBankActor,
} from "@/app/api/organizer/problem-banks/_shared";

const IMPORT_SUMMARY_MESSAGE = "Import completed.";
const IDEMPOTENCY_TOKEN_REGEX = /^[A-Za-z0-9:_.-]{8,128}$/;

type ImportJobRow = {
  id: string;
  status: "processing" | "completed" | "failed";
  total_rows: number;
  inserted_rows: number;
  failed_rows: number;
  row_errors_json: unknown;
  completed_at: string | null;
};

function normalizeRowErrors(value: unknown): ProblemImportParseError[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const rowNumber =
        "rowNumber" in entry && typeof (entry as { rowNumber?: unknown }).rowNumber === "number"
          ? (entry as { rowNumber: number }).rowNumber
          : "row_number" in entry &&
              typeof (entry as { row_number?: unknown }).row_number === "number"
            ? (entry as { row_number: number }).row_number
            : null;

      const reason =
        "reason" in entry && typeof (entry as { reason?: unknown }).reason === "string"
          ? (entry as { reason: string }).reason
          : null;

      if (rowNumber === null || !reason) {
        return null;
      }

      return { rowNumber, reason } satisfies ProblemImportParseError;
    })
    .filter((entry): entry is ProblemImportParseError => entry !== null);
}

function summaryFromJob(job: ImportJobRow) {
  return {
    totalRows: job.total_rows,
    insertedRows: job.inserted_rows,
    failedRows: job.failed_rows,
    rowErrors: normalizeRowErrors(job.row_errors_json),
    completedAt: job.completed_at,
  };
}

function toValidatedImportProblemRow(row: ProblemImportRow): ValidatedProblemWriteInput {
  if (row.type === "mcq") {
    return {
      type: row.type,
      difficulty: row.difficulty,
      tags: row.tags,
      contentLatex: row.contentLatex,
      explanationLatex: row.explanationLatex,
      authoringNotes: row.authoringNotes,
      imagePath: row.imagePath,
      options: row.options,
      answerKey: {
        correctOptionIds: row.answerKey.correctOptionIds,
      },
    };
  }

  if (row.type === "tf") {
    return {
      type: row.type,
      difficulty: row.difficulty,
      tags: row.tags,
      contentLatex: row.contentLatex,
      explanationLatex: row.explanationLatex,
      authoringNotes: row.authoringNotes,
      imagePath: row.imagePath,
      options: row.options,
      answerKey: {
        acceptedAnswer: row.answerKey.acceptedAnswer,
      },
    };
  }

  return {
    type: row.type,
    difficulty: row.difficulty,
    tags: row.tags,
    contentLatex: row.contentLatex,
    explanationLatex: row.explanationLatex,
    authoringNotes: row.authoringNotes,
    imagePath: row.imagePath,
    options: null,
    answerKey: {
      acceptedAnswers: row.answerKey.acceptedAnswers,
    },
  };
}

async function loadExistingJob(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bankId: string,
  actorId: string,
  idempotencyToken: string,
) {
  const { data, error } = await supabase
    .from("problem_import_jobs")
    .select("id, status, total_rows, inserted_rows, failed_rows, row_errors_json, completed_at")
    .eq("bank_id", bankId)
    .eq("actor_id", actorId)
    .eq("idempotency_token", idempotencyToken)
    .maybeSingle<ImportJobRow>();

  if (error) {
    return {
      response: jsonDatabaseError(error),
    } as const;
  }

  return { job: data } as const;
}

export async function GET() {
  const auth = await requireProblemBankActor({
    allowAdmin: true,
    allowOrganizer: true,
  });

  if ("response" in auth) {
    return auth.response;
  }

  const csvTemplate = getProblemBankImportTemplateCsv();
  return new Response(csvTemplate, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="problem-bank-import-template.csv"',
      "cache-control": "no-store",
    },
  });
}

export async function POST(request: Request) {
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

  const { actor, supabase } = auth;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError("validation_failed", "Request validation failed.", 400);
  }

  const bankId = String(formData.get("bankId") ?? "").trim();
  const idempotencyToken = String(formData.get("idempotencyToken") ?? "").trim();
  const csvFile = formData.get("file");

  if (!bankId || !idempotencyToken || !(csvFile instanceof File)) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "formData",
            reason: "bankId, idempotencyToken, and csv file are required.",
          },
        ],
      },
    );
  }

  if (!IDEMPOTENCY_TOKEN_REGEX.test(idempotencyToken)) {
    return jsonError(
      "validation_failed",
      "Request validation failed.",
      400,
      {
        errors: [
          {
            field: "idempotencyToken",
            reason: "idempotencyToken must be 8-128 URL-safe characters.",
          },
        ],
      },
    );
  }

  const bankResult = await fetchProblemBank(supabase, bankId);
  if ("response" in bankResult) {
    return bankResult.response;
  }

  if (!canMutateBank(actor, bankResult.bank)) {
    return jsonError("forbidden", "You do not have permission for this operation.", 403);
  }

  const existingJobResult = await loadExistingJob(
    supabase,
    bankId,
    actor.userId,
    idempotencyToken,
  );

  if ("response" in existingJobResult) {
    return existingJobResult.response;
  }

  if (existingJobResult.job) {
    if (existingJobResult.job.status === "completed") {
      return jsonOk({
        code: "ok",
        message: IMPORT_SUMMARY_MESSAGE,
        idempotentReplay: true,
        summary: summaryFromJob(existingJobResult.job),
      });
    }

    if (existingJobResult.job.status === "processing") {
      return jsonError(
        "write_conflict",
        "An import with this idempotency token is still processing.",
        409,
      );
    }

    return jsonOk({
      code: "import_failed",
      message: "A previous import attempt failed for this token.",
      idempotentReplay: true,
      summary: summaryFromJob(existingJobResult.job),
    });
  }

  const { data: insertedJob, error: insertedJobError } = await supabase
    .from("problem_import_jobs")
    .insert({
      bank_id: bankId,
      actor_id: actor.userId,
      idempotency_token: idempotencyToken,
      status: "processing",
      total_rows: 0,
      inserted_rows: 0,
      failed_rows: 0,
      row_errors_json: [],
    })
    .select("id, status, total_rows, inserted_rows, failed_rows, row_errors_json, completed_at")
    .single<ImportJobRow>();

  if (insertedJobError) {
    if (insertedJobError.code === "23505") {
      return jsonError(
        "write_conflict",
        "An import with this idempotency token already exists.",
        409,
      );
    }

    return jsonDatabaseError(insertedJobError);
  }

  const csvText = await csvFile.text();
  const parseSummary = parseProblemBankImportCsv(csvText);

  const rowErrors: ProblemImportParseError[] = [...parseSummary.errors];
  let insertedRows = 0;

  for (const row of parseSummary.rows) {
    const problemInput = toValidatedImportProblemRow(row);

    const { error } = await supabase
      .from("problems")
      .insert({
        bank_id: bankId,
        is_deleted: false,
        ...toProblemDatabaseColumns(problemInput),
      });

    if (error) {
      rowErrors.push({
        rowNumber: row.rowNumber,
        reason: "row_insert_failed: row could not be imported.",
      });
      continue;
    }

    insertedRows += 1;
  }

  const failedRows = Math.max(parseSummary.totalRows - insertedRows, 0);

  const completionPayload = {
    status: "completed",
    total_rows: parseSummary.totalRows,
    inserted_rows: insertedRows,
    failed_rows: failedRows,
    row_errors_json: rowErrors,
    completed_at: new Date().toISOString(),
  };

  const { data: completedJob, error: completionError } = await supabase
    .from("problem_import_jobs")
    .update(completionPayload)
    .eq("id", insertedJob.id)
    .select("id, status, total_rows, inserted_rows, failed_rows, row_errors_json, completed_at")
    .single<ImportJobRow>();

  if (completionError) {
    await supabase
      .from("problem_import_jobs")
      .update({
        status: "failed",
        total_rows: parseSummary.totalRows,
        inserted_rows: insertedRows,
        failed_rows: failedRows,
        row_errors_json: rowErrors,
      })
      .eq("id", insertedJob.id);

    return jsonDatabaseError(completionError);
  }

  return jsonOk({
    code: "ok",
    message: IMPORT_SUMMARY_MESSAGE,
    idempotentReplay: false,
    summary: summaryFromJob(completedJob),
  });
}
