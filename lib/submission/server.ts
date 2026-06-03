import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCompetitionRecord } from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { ProblemType } from "@/lib/problem-bank/types";
import type { AttemptGradingMode } from "@/lib/scoring/types";
import type { ArenaAttemptAnswer, ArenaProblem } from "@/lib/arena/types";
import { parseArenaOptions } from "@/lib/arena/helpers";
import { buildAttemptReviewRows, countReviewStatuses } from "@/lib/submission/summary";
import { canViewAnswerKeySnapshot } from "@/lib/submission/visibility";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type CompetitionRow = Record<string, unknown>;
type AttemptRow = {
  id: string;
  competition_id: string;
  registration_id: string;
  participant_profile_id: string | null;
  attempt_no: number;
  status: "in_progress" | "submitted" | "auto_submitted" | "disqualified" | "graded";
  started_at: string;
  submitted_at: string | null;
  total_time_seconds: number | null;
  raw_score: number | string | null;
  penalty_score: number | string | null;
  final_score: number | string | null;
  graded_at: string | null;
  is_latest_visible_result: boolean | null;
};
type AttemptAnswerRow = {
  id: string;
  attempt_id: string;
  competition_problem_id: string;
  answer_latex: string | null;
  answer_text_normalized: string | null;
  status_flag: ArenaAttemptAnswer["statusFlag"];
  last_saved_at: string;
  client_updated_at: string | null;
};
type CompetitionProblemRow = {
  id: string;
  competition_id: string;
  problem_id: string;
  order_index: number | null;
  points: number | null;
  problem_type_snapshot: ProblemType | null;
  content_snapshot_latex: string | null;
  options_snapshot_json: unknown;
  answer_key_snapshot_json: unknown;
  explanation_snapshot_latex: string | null;
  difficulty_snapshot: string | null;
  tags_snapshot: string[] | null;
  image_snapshot_path: string | null;
};
type ProblemTypeRow = {
  id: string;
  type: ProblemType;
};
type RegistrationRow = {
  id: string;
  profile_id: string | null;
  team_id: string | null;
};
type TeamMembershipRow = {
  team_id: string;
  role: string;
};
type ProblemDisputeRow = {
  competition_problem_id: string;
  status: "open" | "reviewing" | "accepted" | "rejected" | "resolved";
};

const COMPETITION_DETAIL_SELECT =
  "id, organizer_id, name, description, instructions, type, format, status, answer_key_visibility, registration_start, registration_end, start_time, end_time, duration_minutes, attempts_allowed, multi_attempt_grading_mode, max_participants, participants_per_team, max_teams, scoring_mode, custom_points, penalty_mode, deduction_value, tie_breaker, shuffle_questions, shuffle_options, scoring_snapshot_json, draft_revision, draft_version, is_deleted, published, is_paused, published_at, created_at, updated_at";

function getAdminOrThrow() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for submission workflows.");
  }

  return admin;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function fetchCompetition(admin: AdminClient, competitionId: string) {
  const { data, error } = await admin
    .from("competitions")
    .select(COMPETITION_DETAIL_SELECT)
    .eq("id", competitionId)
    .maybeSingle<CompetitionRow>();

  if (error) {
    throw error;
  }

  return data ? normalizeCompetitionRecord(data) : null;
}

async function fetchActorTeamIds(admin: AdminClient, actorUserId: string) {
  const { data, error } = await admin
    .from("team_memberships")
    .select("team_id, role")
    .eq("profile_id", actorUserId)
    .eq("is_active", true);

  if (error) {
    throw error;
  }

  return new Set(((data ?? []) as TeamMembershipRow[]).map((row) => row.team_id));
}

async function fetchParticipantRegistrations(admin: AdminClient, competitionId: string, actorUserId: string) {
  const teamIds = await fetchActorTeamIds(admin, actorUserId);
  const { data, error } = await admin
    .from("competition_registrations")
    .select("id, profile_id, team_id")
    .eq("competition_id", competitionId)
    .eq("status", "registered");

  if (error) {
    throw error;
  }

  return ((data ?? []) as RegistrationRow[]).filter(
    (row) => row.profile_id === actorUserId || (row.team_id ? teamIds.has(row.team_id) : false),
  );
}

async function fetchAttempt(admin: AdminClient, attemptId: string, registrationIds: string[], actorUserId: string) {
  if (registrationIds.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("competition_attempts")
    .select(
      "id, competition_id, registration_id, participant_profile_id, attempt_no, status, started_at, submitted_at, total_time_seconds, raw_score, penalty_score, final_score, graded_at, is_latest_visible_result",
    )
    .eq("id", attemptId)
    .in("registration_id", registrationIds)
    .eq("participant_profile_id", actorUserId)
    .maybeSingle<AttemptRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchLatestAttempt(admin: AdminClient, registrationIds: string[], actorUserId: string) {
  if (registrationIds.length === 0) {
    return null;
  }

  const { data, error } = await admin
    .from("competition_attempts")
    .select(
      "id, competition_id, registration_id, participant_profile_id, attempt_no, status, started_at, submitted_at, total_time_seconds, raw_score, penalty_score, final_score, graded_at, is_latest_visible_result",
    )
    .in("registration_id", registrationIds)
    .eq("participant_profile_id", actorUserId)
    .order("attempt_no", { ascending: false })
    .limit(1)
    .maybeSingle<AttemptRow>();

  if (error) {
    throw error;
  }

  return data;
}

async function fetchAttemptAnswers(admin: AdminClient, attemptId: string) {
  const { data, error } = await admin
    .from("attempt_answers")
    .select("id, attempt_id, competition_problem_id, answer_latex, answer_text_normalized, status_flag, last_saved_at, client_updated_at")
    .eq("attempt_id", attemptId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as AttemptAnswerRow[]).map(
    (answer) =>
      ({
        id: answer.id,
        attemptId: answer.attempt_id,
        competitionProblemId: answer.competition_problem_id,
        answerLatex: answer.answer_latex ?? "",
        answerTextNormalized: answer.answer_text_normalized ?? "",
        statusFlag: answer.status_flag,
        lastSavedAt: answer.last_saved_at,
        clientUpdatedAt: answer.client_updated_at ?? "",
      }) satisfies ArenaAttemptAnswer,
  );
}

async function fetchCompetitionProblems(admin: AdminClient, competitionId: string) {
  const { data, error } = await admin
    .from("competition_problems")
    .select(
      "id, competition_id, problem_id, order_index, points, problem_type_snapshot, content_snapshot_latex, options_snapshot_json, answer_key_snapshot_json, explanation_snapshot_latex, difficulty_snapshot, tags_snapshot, image_snapshot_path",
    )
    .eq("competition_id", competitionId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as CompetitionProblemRow[];
  const missingTypeProblemIds = rows.filter((row) => !row.problem_type_snapshot).map((row) => row.problem_id);
  const problemTypes = new Map<string, ProblemType>();

  if (missingTypeProblemIds.length > 0) {
    const { data: problemRows, error: problemError } = await admin
      .from("problems")
      .select("id, type")
      .in("id", missingTypeProblemIds);

    if (problemError) {
      throw problemError;
    }

    for (const row of (problemRows ?? []) as ProblemTypeRow[]) {
      problemTypes.set(row.id, row.type);
    }
  }

  return rows.map((row, index) => ({
    competitionProblemId: row.id,
    competitionId: row.competition_id,
    problemId: row.problem_id,
    orderIndex: row.order_index ?? index + 1,
    points: row.points,
    type: row.problem_type_snapshot ?? problemTypes.get(row.problem_id) ?? "mcq",
    contentLatex: row.content_snapshot_latex ?? "",
    explanationLatex: row.explanation_snapshot_latex ?? "",
    options: parseArenaOptions(row.options_snapshot_json),
    imagePath: row.image_snapshot_path,
    tags: row.tags_snapshot ?? [],
    difficulty: row.difficulty_snapshot,
    answerKeyLatex: extractAnswerKeyLatex(row.answer_key_snapshot_json),
  }));
}

function parseJsonAnswerKeyString(value: string): unknown {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function formatAnswerLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractAnswerKeyLatex(value: unknown): string[] {
  if (typeof value === "string") {
    const parsed = parseJsonAnswerKeyString(value);
    if (parsed !== value) {
      return extractAnswerKeyLatex(parsed);
    }

    const formatted = formatAnswerLabel(value);
    return formatted ? [formatted] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractAnswerKeyLatex(entry)).filter(Boolean);
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["acceptedAnswers", "accepted_answers", "correctOptionIds", "correct_option_ids"]) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate.flatMap((entry) => extractAnswerKeyLatex(entry)).filter(Boolean);
      }
    }

    for (const key of ["acceptedAnswer", "accepted_answer", "latex", "answerLatex", "value", "label", "text", "answer"]) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return extractAnswerKeyLatex(candidate);
      }
    }

    return [];
  }

  return [];
}

function mapAttempt(attempt: AttemptRow) {
  return {
    id: attempt.id,
    competitionId: attempt.competition_id,
    registrationId: attempt.registration_id,
    attemptNo: attempt.attempt_no,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    totalTimeSeconds: attempt.total_time_seconds ?? 0,
    rawScore: toNumber(attempt.raw_score),
    penaltyScore: toNumber(attempt.penalty_score),
    finalScore: toNumber(attempt.final_score),
    gradedAt: attempt.graded_at,
    isLatestVisibleResult: Boolean(attempt.is_latest_visible_result),
  };
}

function mapCompetition(record: CompetitionRecord) {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    status: record.status,
    endTime: record.endTime,
    attemptsAllowed: record.attemptsAllowed,
    multiAttemptGradingMode: record.multiAttemptGradingMode as AttemptGradingMode,
    answerKeyVisibility: record.answerKeyVisibility,
  };
}

export async function loadReviewPageData(competitionId: string, actorUserId: string, attemptId?: string | null) {
  const admin = getAdminOrThrow();
  const competition = await fetchCompetition(admin, competitionId);
  if (!competition || competition.isDeleted) {
    return null;
  }

  const registrations = await fetchParticipantRegistrations(admin, competitionId, actorUserId);
  const registrationIds = registrations.map((registration) => registration.id);
  const attempt = attemptId
    ? await fetchAttempt(admin, attemptId, registrationIds, actorUserId)
    : await fetchLatestAttempt(admin, registrationIds, actorUserId);

  if (!attempt) {
    return null;
  }

  const [problems, answers] = await Promise.all([
    fetchCompetitionProblems(admin, competitionId),
    fetchAttemptAnswers(admin, attempt.id),
  ]);
  const rows = buildAttemptReviewRows({ problems, answers });

  return {
    competition: mapCompetition(competition),
    attempt: mapAttempt(attempt),
    problems: problems satisfies Array<ArenaProblem & { answerKeyLatex: string[] }>,
    answers,
    reviewRows: rows,
    counts: countReviewStatuses(rows),
    attemptsRemaining: Math.max(0, competition.attemptsAllowed - attempt.attempt_no),
  };
}

export async function loadReviewSubmissionPageData(
  competitionId: string,
  actorUserId: string,
  attemptId?: string | null,
) {
  const data = await loadReviewPageData(competitionId, actorUserId, attemptId);
  if (!data) {
    return null;
  }

  const answersByProblem = new Map(data.answers.map((answer) => [answer.competitionProblemId, answer]));

  return {
    competition: {
      id: data.competition.id,
      name: data.competition.name,
      type: data.competition.type,
      status: data.competition.status,
      attemptsAllowed: data.competition.attemptsAllowed,
      multiAttemptGradingMode: data.competition.multiAttemptGradingMode,
    },
    attempt: {
      id: data.attempt.id,
      attemptNo: data.attempt.attemptNo,
      status: data.attempt.status,
      submittedAt: data.attempt.submittedAt,
      finalScore: data.attempt.finalScore,
      rawScore: data.attempt.rawScore,
      penaltyScore: data.attempt.penaltyScore,
      gradedAt: data.attempt.gradedAt,
    },
    attemptsRemaining: data.attemptsRemaining,
    summaryCounts: {
      total: data.counts.total,
      blank: data.counts.blank,
      filled: data.counts.filled,
      solved: data.counts.solved,
      reset: data.counts.reset,
    },
    problems: data.problems.map((problem) => {
      const answer = answersByProblem.get(problem.competitionProblemId);
      return {
        competitionProblemId: problem.competitionProblemId,
        orderIndex: problem.orderIndex,
        points: problem.points,
        type: problem.type,
        contentLatex: problem.contentLatex,
        answerLatex: answer?.answerLatex ?? "",
        answerTextNormalized: answer?.answerTextNormalized ?? "",
        statusFlag: answer?.statusFlag ?? "blank",
      };
    }),
  };
}

export async function loadAnswerKeyPageData(competitionId: string, actorUserId: string) {
  const admin = getAdminOrThrow();
  const competition = await fetchCompetition(admin, competitionId);
  if (!competition || competition.isDeleted) {
    return null;
  }

  const registrations = await fetchParticipantRegistrations(admin, competitionId, actorUserId);
  const registrationIds = registrations.map((registration) => registration.id);
  if (registrationIds.length === 0) {
    return null;
  }

  const [attempt, problems] = await Promise.all([
    fetchLatestAttempt(admin, registrationIds, actorUserId),
    fetchCompetitionProblems(admin, competitionId),
  ]);
  const visibility = canViewAnswerKeySnapshot({
    answerKeyVisibility: competition.answerKeyVisibility,
    competitionStatus: competition.status,
    competitionType: competition.type,
    competitionEndTime: competition.endTime,
    hasParticipantContext: true,
    attemptsAllowed: competition.attemptsAllowed,
    latestAttemptNo: attempt?.attempt_no ?? 0,
    latestAttemptStatus: attempt?.status ?? null,
  });
  const disputesByProblem = new Map<string, ProblemDisputeRow["status"]>();

  if (attempt) {
    const { data: disputeRows, error } = await admin
      .from("problem_disputes")
      .select("competition_problem_id, status")
      .eq("attempt_id", attempt.id)
      .eq("reporter_id", actorUserId)
      .in("status", ["open", "reviewing"]);

    if (error) {
      throw error;
    }

    for (const row of (disputeRows ?? []) as ProblemDisputeRow[]) {
      disputesByProblem.set(row.competition_problem_id, row.status);
    }
  }

  return {
    competition: mapCompetition(competition),
    attempt: attempt ? mapAttempt(attempt) : null,
    problems: problems.map((problem) => ({
      ...problem,
      existingDisputeStatus: disputesByProblem.get(problem.competitionProblemId) ?? null,
    })),
    visibility,
  };
}

export async function createProblemDispute(input: {
  competitionId: string;
  competitionProblemId: string;
  attemptId: string;
  reporterId: string;
  reason: string;
}) {
  const admin = getAdminOrThrow();
  const { data, error } = await admin.rpc("create_problem_dispute", {
    p_competition_id: input.competitionId,
    p_competition_problem_id: input.competitionProblemId,
    p_attempt_id: input.attemptId,
    p_reporter_id: input.reporterId,
    p_reason: input.reason,
  });

  if (error) {
    throw error;
  }

  return ((Array.isArray(data) ? data[0] : data) ?? null) as {
    machine_code: string;
    dispute_id: string | null;
    status: "open" | "reviewing" | "accepted" | "rejected" | "resolved" | null;
    replayed: boolean;
  } | null;
}
