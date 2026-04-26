import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeCompetitionRecord } from "@/lib/competition/api";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { ProblemType } from "@/lib/problem-bank/types";
import {
  computeRemainingSeconds,
  determineCompetitionPageMode,
  normalizeArenaAnswerValue,
  parseArenaOptions,
  resolvePersistedAnswerStatusFlag,
} from "@/lib/arena/helpers";
import type {
  AnswerStatusFlag,
  ArenaAttemptAnswer,
  ArenaAttemptSummary,
  ArenaCompetitionListItem,
  ArenaCompetitionSummary,
  ArenaPageData,
  ArenaProblem,
  ArenaRegistrationSummary,
  EligibleTeamSummary,
  SaveArenaAnswerInput,
} from "@/lib/arena/types";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

type CompetitionRow = Record<string, unknown>;
type RegistrationRow = {
  id: string;
  competition_id: string;
  profile_id: string | null;
  team_id: string | null;
  status: ArenaRegistrationSummary["status"];
  status_reason: string | null;
  registered_at: string;
  updated_at: string;
};
type AttemptRow = {
  id: string;
  competition_id: string;
  registration_id: string;
  attempt_no: number;
  status: ArenaAttemptSummary["status"];
  started_at: string;
  submitted_at: string | null;
  total_time_seconds: number | null;
  effective_attempt_deadline_at: string | null;
  attempt_base_deadline_at: string | null;
  scheduled_competition_end_cap_at: string | null;
};
type AttemptAnswerRow = {
  id: string;
  attempt_id: string;
  competition_problem_id: string;
  answer_latex: string | null;
  answer_text_normalized: string | null;
  status_flag: AnswerStatusFlag;
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
  explanation_snapshot_latex: string | null;
  difficulty_snapshot: string | null;
  tags_snapshot: string[] | null;
  image_snapshot_path: string | null;
};
type ProblemTypeRow = {
  id: string;
  type: ProblemType;
};
type TeamMembershipRow = {
  team_id: string;
  role: string;
  teams: Array<{ id: string; name: string }> | null;
};
type RpcLifecycleRow = {
  machine_code: string;
  attempt_id?: string | null;
  competition_id?: string | null;
  attempt_no?: number | null;
  remaining_seconds?: number | null;
  started_at?: string | null;
  replayed?: boolean | null;
  status?: string | null;
  submitted_at?: string | null;
  answer_id?: string | null;
  last_saved_at?: string | null;
};

const COMPETITION_DETAIL_SELECT =
  "id, organizer_id, name, description, instructions, type, format, status, answer_key_visibility, registration_start, registration_end, start_time, end_time, duration_minutes, attempts_allowed, multi_attempt_grading_mode, max_participants, participants_per_team, max_teams, scoring_mode, custom_points, penalty_mode, deduction_value, tie_breaker, shuffle_questions, shuffle_options, log_tab_switch, offense_penalties, scoring_snapshot_json, draft_revision, draft_version, is_deleted, published, is_paused, published_at, created_at, updated_at";

function getAdminOrThrow() {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for arena workflows.");
  }

  return admin;
}

function createRequestToken(prefix: string, id: string) {
  return createHash("sha256")
    .update(`arena:${prefix}:${id}:${Date.now()}:${Math.random()}`)
    .digest("hex");
}

function mapCompetitionSummary(record: CompetitionRecord): ArenaCompetitionSummary {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    instructions: record.instructions,
    type: record.type,
    format: record.format,
    status: record.status,
    registrationStart: record.registrationStart,
    registrationEnd: record.registrationEnd,
    startTime: record.startTime,
    endTime: record.endTime,
    durationMinutes: record.durationMinutes,
    attemptsAllowed: record.attemptsAllowed,
    participantsPerTeam: record.participantsPerTeam,
  };
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

async function fetchEligibleTeams(admin: AdminClient, actorUserId: string) {
  const { data, error } = await admin
    .from("team_memberships")
    .select("team_id, role, teams(id, name)")
    .eq("profile_id", actorUserId)
    .eq("is_active", true)
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as TeamMembershipRow[];

  return rows.map((row) => ({
    id: row.team_id,
    name: row.teams?.[0]?.name ?? "Unnamed team",
    role: row.role,
  })) satisfies EligibleTeamSummary[];
}

async function fetchRegistrations(
  admin: AdminClient,
  competitionId: string,
  actorUserId: string,
  teams: EligibleTeamSummary[],
) {
  const individualQuery = admin
    .from("competition_registrations")
    .select("id, competition_id, profile_id, team_id, status, status_reason, registered_at, updated_at")
    .eq("competition_id", competitionId)
    .eq("profile_id", actorUserId);

  const teamIds = teams.map((team) => team.id);
  const teamQuery =
    teamIds.length > 0
      ? admin
          .from("competition_registrations")
          .select("id, competition_id, profile_id, team_id, status, status_reason, registered_at, updated_at")
          .eq("competition_id", competitionId)
          .in("team_id", teamIds)
      : Promise.resolve({ data: [], error: null });

  const [{ data: individualRows, error: individualError }, { data: teamRows, error: teamError }] =
    await Promise.all([individualQuery, teamQuery]);

  if (individualError) {
    throw individualError;
  }

  if (teamError) {
    throw teamError;
  }

  const registrations = [...((individualRows ?? []) as RegistrationRow[]), ...((teamRows ?? []) as RegistrationRow[])];
  return registrations;
}

async function fetchAttempts(admin: AdminClient, registrationId: string) {
  const { data, error } = await admin
    .from("competition_attempts")
    .select(
      "id, competition_id, registration_id, attempt_no, status, started_at, submitted_at, total_time_seconds, effective_attempt_deadline_at, attempt_base_deadline_at, scheduled_competition_end_cap_at",
    )
    .eq("registration_id", registrationId)
    .order("attempt_no", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []) as AttemptRow[];
}

async function fetchAttemptAnswers(admin: AdminClient, attemptId: string) {
  const { data, error } = await admin
    .from("attempt_answers")
    .select(
      "id, attempt_id, competition_problem_id, answer_latex, answer_text_normalized, status_flag, last_saved_at, client_updated_at",
    )
    .eq("attempt_id", attemptId);

  if (error) {
    throw error;
  }

  return (data ?? []) as AttemptAnswerRow[];
}

async function fetchCompetitionProblems(admin: AdminClient, competitionId: string) {
  const { data, error } = await admin
    .from("competition_problems")
    .select(
      "id, competition_id, problem_id, order_index, points, problem_type_snapshot, content_snapshot_latex, options_snapshot_json, explanation_snapshot_latex, difficulty_snapshot, tags_snapshot, image_snapshot_path",
    )
    .eq("competition_id", competitionId)
    .order("order_index", { ascending: true });

  if (error) {
    throw error;
  }

  const competitionProblems = (data ?? []) as CompetitionProblemRow[];
  const missingTypeProblemIds = competitionProblems
    .filter((problem) => !problem.problem_type_snapshot)
    .map((problem) => problem.problem_id);

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

  return competitionProblems.map((problem) => ({
    competitionProblemId: problem.id,
    competitionId: problem.competition_id,
    problemId: problem.problem_id,
    orderIndex: problem.order_index ?? 0,
    points: problem.points,
    type: problem.problem_type_snapshot ?? problemTypes.get(problem.problem_id) ?? "mcq",
    contentLatex: problem.content_snapshot_latex ?? "",
    explanationLatex: problem.explanation_snapshot_latex ?? "",
    options: parseArenaOptions(problem.options_snapshot_json),
    imagePath: problem.image_snapshot_path,
    tags: problem.tags_snapshot ?? [],
    difficulty: problem.difficulty_snapshot,
  })) satisfies ArenaProblem[];
}

function buildRegistrationSummary(
  registration: RegistrationRow | null,
  competition: ArenaCompetitionSummary,
  teams: EligibleTeamSummary[],
) {
  if (!registration) {
    return null;
  }

  const team = registration.team_id ? teams.find((entry) => entry.id === registration.team_id) ?? null : null;
  const actorIsLeader = team?.role === "leader";
  const actorCanStart = registration.team_id ? actorIsLeader : true;
  const actorCanWrite = actorCanStart;

  return {
    id: registration.id,
    competitionId: registration.competition_id,
    profileId: registration.profile_id,
    teamId: registration.team_id,
    status: registration.status,
    statusReason: registration.status_reason,
    registeredAt: registration.registered_at,
    updatedAt: registration.updated_at,
    actorIsLeader,
    actorCanStart,
    actorCanWrite,
    teamName: team?.name ?? null,
  } satisfies ArenaRegistrationSummary;
}

function buildAttemptSummary(
  attempt: AttemptRow | null,
  answers: ArenaAttemptAnswer[],
  now = new Date(),
) {
  if (!attempt) {
    return null;
  }

  return {
    id: attempt.id,
    competitionId: attempt.competition_id,
    registrationId: attempt.registration_id,
    attemptNo: attempt.attempt_no,
    status: attempt.status,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    totalTimeSeconds: attempt.total_time_seconds ?? 0,
    remainingSeconds: computeRemainingSeconds(attempt.effective_attempt_deadline_at, now),
    effectiveAttemptDeadlineAt: attempt.effective_attempt_deadline_at,
    attemptBaseDeadlineAt: attempt.attempt_base_deadline_at,
    scheduledCompetitionEndCapAt: attempt.scheduled_competition_end_cap_at,
    answers,
  } satisfies ArenaAttemptSummary;
}

function chooseRelevantRegistration(
  competition: ArenaCompetitionSummary,
  registrations: RegistrationRow[],
  teams: EligibleTeamSummary[],
) {
  if (competition.format === "individual") {
    return registrations.find((registration) => registration.profile_id !== null) ?? null;
  }

  const leaderTeamIds = new Set(
    teams.filter((team) => team.role === "leader").map((team) => team.id),
  );

  return (
    registrations.find((registration) => registration.team_id && leaderTeamIds.has(registration.team_id)) ??
    registrations[0] ??
    null
  );
}

function normalizeAttemptAnswers(
  answers: AttemptAnswerRow[],
  problems: ArenaProblem[],
) {
  const answersByProblemId = new Map(answers.map((answer) => [answer.competition_problem_id, answer]));

  return problems.map((problem) => {
    const answer = answersByProblemId.get(problem.competitionProblemId);

    return {
      id: answer?.id ?? `blank-${problem.competitionProblemId}`,
      attemptId: answer?.attempt_id ?? "",
      competitionProblemId: problem.competitionProblemId,
      answerLatex: answer?.answer_latex ?? "",
      answerTextNormalized: answer?.answer_text_normalized ?? "",
      statusFlag: answer?.status_flag ?? "blank",
      lastSavedAt: answer?.last_saved_at ?? "",
      clientUpdatedAt: answer?.client_updated_at ?? "",
    } satisfies ArenaAttemptAnswer;
  });
}

export async function loadArenaPageData(competitionId: string, actorUserId: string): Promise<ArenaPageData | null> {
  const admin = getAdminOrThrow();
  const competitionRecord = await fetchCompetition(admin, competitionId);

  if (!competitionRecord || competitionRecord.isDeleted) {
    return null;
  }

  const competition = mapCompetitionSummary(competitionRecord);
  const eligibleTeams = await fetchEligibleTeams(admin, actorUserId);
  const registrations = await fetchRegistrations(admin, competitionId, actorUserId, eligibleTeams);
  const registrationRow = chooseRelevantRegistration(competition, registrations, eligibleTeams);
  const registration = buildRegistrationSummary(registrationRow, competition, eligibleTeams);
  const attempts = registration ? await fetchAttempts(admin, registration.id) : [];
  const activeAttemptRow = attempts.find((attempt) => attempt.status === "in_progress") ?? null;
  const latestAttemptRow = attempts[0] ?? null;
  const problems = await fetchCompetitionProblems(admin, competitionId);

  let activeAttemptAnswers: ArenaAttemptAnswer[] = [];
  if (activeAttemptRow) {
    const answerRows = await fetchAttemptAnswers(admin, activeAttemptRow.id);
    activeAttemptAnswers = normalizeAttemptAnswers(answerRows, problems);
  }

  const now = new Date();
  const attemptsRemaining = registration
    ? Math.max(0, competition.attemptsAllowed - attempts.length)
    : competition.attemptsAllowed;
  const mode = determineCompetitionPageMode({
    hasActiveAttempt: Boolean(activeAttemptRow),
    hasRegistration: Boolean(registration),
    registrationStatus: registration?.status ?? null,
    competitionStatus: competition.status,
    competitionType: competition.type,
    attemptsRemaining,
  });

  return {
    mode,
    competition,
    registration,
    activeAttempt: buildAttemptSummary(activeAttemptRow, activeAttemptAnswers, now),
    latestAttempt: buildAttemptSummary(latestAttemptRow, activeAttemptRow ? activeAttemptAnswers : [], now),
    problems,
    eligibleTeams,
    attemptsRemaining,
    canRegister: !registration && (competition.status === "published" || competition.status === "live"),
    canResume: Boolean(activeAttemptRow),
    nowIso: now.toISOString(),
  };
}

export async function loadArenaCompetitionList(actorUserId: string) {
  const admin = getAdminOrThrow();
  const { data, error } = await admin
    .from("competitions")
    .select(COMPETITION_DETAIL_SELECT)
    .eq("is_deleted", false)
    .in("status", ["published", "live", "paused"])
    .order("start_time", { ascending: true, nullsFirst: true })
    .limit(25);

  if (error) {
    throw error;
  }

  const competitions = (data ?? [])
    .map((row) => normalizeCompetitionRecord(row as CompetitionRow))
    .filter((row): row is CompetitionRecord => row !== null);

  const items: ArenaCompetitionListItem[] = [];
  for (const competition of competitions) {
    const pageData = await loadArenaPageData(competition.id, actorUserId);
    if (!pageData) {
      continue;
    }

    items.push({
      competition: pageData.competition,
      registration: pageData.registration,
      mode: pageData.mode,
      activeAttemptId: pageData.activeAttempt?.id ?? null,
    });
  }

  return items;
}

export async function registerForCompetition(
  competitionId: string,
  actorUserId: string,
  teamId?: string | null,
) {
  const admin = getAdminOrThrow();
  const { data, error } = await admin.rpc("register_for_competition", {
    p_competition_id: competitionId,
    p_actor_user_id: actorUserId,
    p_team_id: teamId ?? null,
  });

  if (error) {
    throw error;
  }

  return ((Array.isArray(data) ? data[0] : data) ?? null) as {
    machine_code: string;
    registration_id: string | null;
    competition_id: string | null;
    status: string | null;
  } | null;
}

async function ensureOpenCompetitionRegistration(competitionId: string, actorUserId: string) {
  const competition = await fetchCompetition(getAdminOrThrow(), competitionId);
  if (!competition || competition.isDeleted) {
    return {
      machine_code: "competition_not_found",
      registration_id: null,
      competition_id: competitionId,
      status: null,
    };
  }

  if (competition.type !== "open") {
    return {
      machine_code: "registration_id_required",
      registration_id: null,
      competition_id: competitionId,
      status: null,
    };
  }

  if (competition.format !== "individual") {
    return {
      machine_code: "individual_registration_required",
      registration_id: null,
      competition_id: competitionId,
      status: null,
    };
  }

  return registerForCompetition(competitionId, actorUserId, null);
}

export async function startCompetitionAttempt(registrationId: string, actorUserId: string) {
  const admin = getAdminOrThrow();
  const { data, error } = await admin.rpc("start_competition_attempt", {
    p_registration_id: registrationId,
    p_actor_user_id: actorUserId,
    p_request_idempotency_token: createRequestToken("start", registrationId),
  });

  if (error) {
    throw error;
  }

  return ((Array.isArray(data) ? data[0] : data) ?? null) as RpcLifecycleRow | null;
}

export async function startOpenCompetitionAttempt(competitionId: string, actorUserId: string) {
  const registration = await ensureOpenCompetitionRegistration(competitionId, actorUserId);
  if (
    !registration ||
    !registration.registration_id ||
    (registration.machine_code !== "ok" && registration.machine_code !== "already_registered")
  ) {
    return {
      machine_code: registration?.machine_code ?? "registration_failed",
      competition_id: competitionId,
    } as RpcLifecycleRow;
  }

  return startCompetitionAttempt(registration.registration_id, actorUserId);
}

export async function resumeCompetitionAttempt(attemptId: string, actorUserId: string) {
  const admin = getAdminOrThrow();
  const { data, error } = await admin.rpc("resume_competition_attempt", {
    p_attempt_id: attemptId,
    p_actor_user_id: actorUserId,
    p_request_idempotency_token: createRequestToken("resume", attemptId),
  });

  if (error) {
    throw error;
  }

  return ((Array.isArray(data) ? data[0] : data) ?? null) as RpcLifecycleRow | null;
}

export async function closeActiveAttemptInterval(attemptId: string, actorUserId: string) {
  const admin = getAdminOrThrow();
  const { data, error } = await admin.rpc("close_active_attempt_interval", {
    p_attempt_id: attemptId,
    p_actor_user_id: actorUserId,
  });

  if (error) {
    throw error;
  }

  return typeof data === "number" ? data : Number(data ?? 0);
}

export async function saveArenaAnswer(input: SaveArenaAnswerInput) {
  const admin = getAdminOrThrow();
  const normalized = normalizeArenaAnswerValue(input.problemType, input.rawValue);
  const statusFlag = resolvePersistedAnswerStatusFlag(
    input.problemType,
    input.rawValue,
    input.statusFlag,
  );

  const { data, error } = await admin.rpc("save_attempt_answer", {
    p_attempt_id: input.attemptId,
    p_actor_user_id: input.actorUserId,
    p_competition_problem_id: input.competitionProblemId,
    p_answer_latex: statusFlag === "reset" ? "" : normalized.answerLatex,
    p_answer_text_normalized: statusFlag === "reset" ? "" : normalized.answerTextNormalized,
    p_status_flag: statusFlag,
    p_client_updated_at: input.clientUpdatedAt,
  });

  if (error) {
    throw error;
  }

  return ((Array.isArray(data) ? data[0] : data) ?? null) as RpcLifecycleRow | null;
}

export async function submitCompetitionAttempt(attemptId: string, actorUserId: string, submissionKind: "manual" | "auto") {
  const admin = getAdminOrThrow();
  const { data, error } = await admin.rpc("submit_competition_attempt", {
    p_attempt_id: attemptId,
    p_actor_user_id: actorUserId,
    p_request_idempotency_token: createRequestToken(submissionKind, attemptId),
    p_submission_kind: submissionKind,
  });

  if (error) {
    throw error;
  }

  return ((Array.isArray(data) ? data[0] : data) ?? null) as RpcLifecycleRow | null;
}

export async function syncAttemptStateForClient(competitionId: string, actorUserId: string) {
  const pageData = await loadArenaPageData(competitionId, actorUserId);
  if (!pageData) {
    return null;
  }

  if (
    pageData.activeAttempt &&
    pageData.activeAttempt.remainingSeconds <= 0 &&
    pageData.activeAttempt.status === "in_progress"
  ) {
    await submitCompetitionAttempt(pageData.activeAttempt.id, actorUserId, "auto");
    return loadArenaPageData(competitionId, actorUserId);
  }

  return pageData;
}
