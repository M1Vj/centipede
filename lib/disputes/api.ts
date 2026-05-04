import { createClient } from "@/lib/supabase/server";

type SupabaseError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
};

type CompetitionProblemRow = {
  id: string;
  content_snapshot_latex: string | null;
  order_index: number | null;
};

type DisputeRow = {
  id: string;
  competition_problem_id: string;
  attempt_id: string;
  reporter_id: string;
  reason: string;
  status: "open" | "reviewing" | "accepted" | "rejected" | "resolved";
  resolution_note: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

export type CompetitionDispute = {
  id: string;
  competitionProblemId: string;
  attemptId: string;
  reporterId: string;
  reporterName: string;
  reason: string;
  status: "open" | "reviewing" | "accepted" | "rejected" | "resolved";
  resolutionNote: string | null;
  resolvedBy: string | null;
  resolvedByName: string | null;
  problemLatex: string;
  problemOrderIndex: number | null;
  createdAt: string;
  resolvedAt: string | null;
};

function isDisputeSchemaCompatibilityError(error: SupabaseError | null | undefined) {
  if (!error) {
    return false;
  }

  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    message.includes("problem_disputes") ||
    message.includes("competition_problem_corrections")
  );
}

export async function listCompetitionDisputes(input: {
  competitionId: string;
}): Promise<CompetitionDispute[]> {
  const supabase = await createClient();
  const { data: competitionProblems, error: competitionProblemError } = await supabase
    .from("competition_problems")
    .select("id, content_snapshot_latex, order_index")
    .eq("competition_id", input.competitionId)
    .returns<CompetitionProblemRow[]>();

  if (competitionProblemError) {
    if (isDisputeSchemaCompatibilityError(competitionProblemError)) {
      return [];
    }

    throw competitionProblemError;
  }

  const problemLookup = new Map<string, CompetitionProblemRow>(
    (competitionProblems ?? []).map((problem) => [problem.id, problem]),
  );
  const problemIds = Array.from(problemLookup.keys());

  if (problemIds.length === 0) {
    return [];
  }

  const { data: disputes, error: disputeError } = await supabase
    .from("problem_disputes")
    .select(
      "id, competition_problem_id, attempt_id, reporter_id, reason, status, resolution_note, resolved_by, created_at, resolved_at",
    )
    .in("competition_problem_id", problemIds)
    .order("created_at", { ascending: false })
    .returns<DisputeRow[]>();

  if (disputeError) {
    if (isDisputeSchemaCompatibilityError(disputeError)) {
      return [];
    }

    throw disputeError;
  }

  const userIds = Array.from(
    new Set(
      (disputes ?? [])
        .flatMap((dispute) => [dispute.reporter_id, dispute.resolved_by])
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  );

  const profileLookup = new Map<string, ProfileRow>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", userIds)
      .returns<ProfileRow[]>();

    if (profileError) {
      throw profileError;
    }

    for (const profile of profiles ?? []) {
      profileLookup.set(profile.id, profile);
    }
  }

  return (disputes ?? []).map((dispute) => {
    const problem = problemLookup.get(dispute.competition_problem_id);
    const reporterName = profileLookup.get(dispute.reporter_id)?.full_name?.trim() || "Mathlete";
    const resolvedByName = dispute.resolved_by
      ? profileLookup.get(dispute.resolved_by)?.full_name?.trim() || null
      : null;

    return {
      id: dispute.id,
      competitionProblemId: dispute.competition_problem_id,
      attemptId: dispute.attempt_id,
      reporterId: dispute.reporter_id,
      reporterName,
      reason: dispute.reason,
      status: dispute.status,
      resolutionNote: dispute.resolution_note,
      resolvedBy: dispute.resolved_by,
      resolvedByName,
      problemLatex: problem?.content_snapshot_latex ?? "",
      problemOrderIndex: problem?.order_index ?? null,
      createdAt: dispute.created_at,
      resolvedAt: dispute.resolved_at,
    };
  });
}

export function mapDisputeMachineCodeToStatus(machineCode: string): number {
  if (
    machineCode === "forbidden" ||
    machineCode === "unauthorized" ||
    machineCode === "actor_required"
  ) {
    return 403;
  }

  if (machineCode === "not_found" || machineCode === "deleted") {
    return 404;
  }

  if (
    machineCode === "invalid_transition" ||
    machineCode === "invalid_status" ||
    machineCode === "request_idempotency_token_required" ||
    machineCode === "resolution_note_required" ||
    machineCode === "dispute_id_required"
  ) {
    return 409;
  }

  return 400;
}
