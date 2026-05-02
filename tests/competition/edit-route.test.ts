import { beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH, DELETE } from "@/app/api/organizer/competitions/[competitionId]/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { COMPETITION_SELECT_COLUMNS, LEGACY_COMPETITION_SELECT_COLUMNS } from "@/lib/competition/api";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const ORGANIZER_ID = "organizer-1";
const COMPETITION_ID = "competition-1";

function makePatchRequest(payload: Record<string, unknown>) {
  return new Request(`http://localhost:3000/api/organizer/competitions/${COMPETITION_ID}`, {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function makeDeleteRequest() {
  return new Request(`http://localhost:3000/api/organizer/competitions/${COMPETITION_ID}`, {
    method: "DELETE",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "x-idempotency-key": "idem-token-123",
    },
  });
}

function buildCompetitionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Legacy Draft",
    description: "Legacy save coverage",
    instructions: "Read carefully.",
    type: "scheduled",
    format: "individual",
    status: "draft",
    answer_key_visibility: "after_end",
    registration_start: null,
    registration_end: "2026-06-01T09:00:00.000Z",
    start_time: "2026-06-01T09:00:00.000Z",
    end_time: "2026-06-01T10:30:00.000Z",
    duration_minutes: 90,
    attempts_allowed: 1,
    multi_attempt_grading_mode: "highest_score",
    max_participants: 30,
    participants_per_team: null,
    max_teams: null,
    scoring_mode: "difficulty",
    custom_points: {},
    penalty_mode: "none",
    deduction_value: 0,
    tie_breaker: "earliest_final_submission",
    shuffle_questions: false,
    shuffle_options: false,
    log_tab_switch: false,
    offense_penalties: [],
    scoring_snapshot_json: null,
    draft_revision: 1,
    draft_version: 1,
    is_deleted: false,
    published_at: null,
    published: false,
    is_paused: false,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildLegacyCompetitionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Legacy Draft",
    description: "Legacy save coverage",
    instructions: "Read carefully.",
    type: "scheduled",
    format: "individual",
    registration_start: null,
    registration_end: "2026-06-01T09:00:00.000Z",
    start_time: "2026-06-01T09:00:00.000Z",
    duration_minutes: 90,
    attempts_allowed: 1,
    max_participants: 30,
    participants_per_team: null,
    max_teams: null,
    scoring_mode: "automatic",
    custom_points: {},
    penalty_mode: "none",
    deduction_value: 0,
    tie_breaker: "average_time",
    shuffle_questions: false,
    shuffle_options: false,
    log_tab_switch: false,
    offense_penalties: [],
    published: false,
    is_paused: false,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeServerClient(options: {
  competitionSelectResults?: Partial<
    Record<
      typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS,
      Array<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>
    >
  >;
  selectedProblemIds?: string[];
} = {}) {
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: ORGANIZER_ID,
        role: "organizer",
        is_active: true,
      },
      error: null,
    }),
  };
  profileQuery.select.mockImplementation(() => profileQuery);
  profileQuery.eq.mockImplementation(() => profileQuery);

  const competitionReadQueues = new Map(
    Object.entries(options.competitionSelectResults ?? {}).map(([columns, queue]) => [columns, [...queue]]),
  );

  function makeCompetitionMaybeSingle(
    columns: typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS,
  ) {
    return {
      eq: vi.fn().mockImplementation(() => makeCompetitionMaybeSingle(columns)),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const queue = competitionReadQueues.get(columns) ?? [];
        if (queue.length === 0) {
          return { data: null, error: null };
        }

        const next = queue.shift() ?? { data: null, error: null };
        competitionReadQueues.set(columns, queue);
        return next;
      }),
    };
  }

  const competitionProblemsQuery = {
    eq: vi.fn(),
    order: vi.fn().mockResolvedValue({
      data: (options.selectedProblemIds ?? []).map((problemId) => ({ problem_id: problemId })),
      error: null,
    }),
  };
  competitionProblemsQuery.eq.mockImplementation(() => competitionProblemsQuery);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: ORGANIZER_ID,
          },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return profileQuery;
      }

      if (table === "competitions") {
        return {
          select: vi.fn(
            (columns: typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS) =>
              makeCompetitionMaybeSingle(columns),
          ),
        };
      }

      if (table === "competition_problems") {
        return {
          select: vi.fn(() => competitionProblemsQuery),
        };
      }

      if (table === "problems") {
        const problemsQuery = {
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: (options.selectedProblemIds ?? []).map((problemId) => ({ id: problemId })),
            error: null,
          }),
        };

        return {
          select: vi.fn(() => problemsQuery),
        };
      }

      throw new Error(`Unexpected table in server client: ${table}`);
    }),
  };
}

describe("competition edit route legacy compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("patch falls back to legacy competition select columns when save RPC is unavailable", async () => {
    const offensePenalties = [{ threshold: 2, penaltyKind: "warning", deductionValue: 0 }];

    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [{ data: buildCompetitionRow(), error: null }],
        },
      }) as never,
    );

    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildLegacyCompetitionRow({ name: "Legacy Draft Updated" }),
        error: null,
      }),
    };
    updateQuery.eq.mockImplementation(() => updateQuery);
    updateQuery.select.mockImplementation(() => updateQuery);

    let updatePayload: Record<string, unknown> | null = null;
    const adminFrom = vi.fn((table: string) => {
      if (table === "competitions") {
        return {
          update: vi.fn((payload: Record<string, unknown>) => {
            updatePayload = payload;
            return updateQuery;
          }),
        };
      }

      if (table === "competition_problems") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          })),
        };
      }

      throw new Error(`Unexpected table in admin client: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42883",
          message: "function public.save_competition_draft(uuid, integer, jsonb) does not exist",
        },
      }),
      from: adminFrom,
    } as never);

    const response = await PATCH(
      makePatchRequest({
        ...buildCompetitionRow({ name: "Legacy Draft Updated" }),
        registrationTimingMode: "default",
        registrationStart: null,
        registrationEnd: null,
        startTime: "2026-06-01T09:00:00.000Z",
        endTime: null,
        logTabSwitch: true,
        offensePenalties,
        selectedProblemIds: [],
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.name).toBe("Legacy Draft Updated");
    expect(updateQuery.select).toHaveBeenCalledWith(LEGACY_COMPETITION_SELECT_COLUMNS);
    expect(updatePayload).not.toHaveProperty("offense_penalties_json");
    expect(updatePayload).toEqual(
      expect.objectContaining({
        log_tab_switch: true,
        offense_penalties: offensePenalties,
      }),
    );
  });

  test("patch serializes modern scoring tokens before save", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [
            { data: buildCompetitionRow(), error: null },
            { data: buildCompetitionRow(), error: null },
          ],
        },
        selectedProblemIds: ["problem-1"],
      }) as never,
    );

    const rpcPayloads: Array<Record<string, unknown>> = [];
    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockImplementation(async (_name: string, payload: Record<string, unknown>) => {
        rpcPayloads.push(payload);
        return {
          data: [{ machine_code: "ok", selected_problem_count: 1, current_draft_revision: 2 }],
          error: null,
        };
      }),
      from: vi.fn((table: string) => {
        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      makePatchRequest({
        name: "Modern Draft Updated",
        description: "Legacy save coverage",
        instructions: "Read carefully.",
        type: "scheduled",
        format: "individual",
        registrationTimingMode: "default",
        registrationStart: null,
        registrationEnd: null,
        startTime: "2026-06-01T09:00:00.000Z",
        endTime: "2026-06-01T10:30:00.000Z",
        durationMinutes: 90,
        attemptsAllowed: 1,
        multiAttemptGradingMode: "highest_score",
        maxParticipants: 30,
        participantsPerTeam: null,
        maxTeams: null,
        scoringMode: "difficulty",
        customPointsByProblemId: {},
        penaltyMode: "fixed_deduction",
        tieBreaker: "lowest_total_time",
        shuffleQuestions: false,
        shuffleOptions: false,
        logTabSwitch: false,
        offensePenalties: [],
        answerKeyVisibility: "after_end",
        deductionValue: 1,
        selectedProblemIds: ["problem-1"],
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("draft");
    expect(rpcPayloads[0]).toEqual(
      expect.objectContaining({
        p_payload_json: expect.objectContaining({
          scoringMode: "automatic",
          penaltyMode: "deduction",
          tieBreaker: "average_time",
        }),
      }),
    );
  });

  test("patch re-reads draft when save RPC returns no row data", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [
            { data: buildCompetitionRow(), error: null },
            { data: buildCompetitionRow({ name: "Modern Draft Updated" }), error: null },
          ],
        },
      }) as never,
    );

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            update: vi.fn(),
          };
        }

        if (table === "competition_problems") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            })),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      makePatchRequest({
        name: "Modern Draft Updated",
        description: "Legacy save coverage",
        instructions: "Read carefully.",
        type: "scheduled",
        format: "individual",
        registrationTimingMode: "default",
        registrationStart: null,
        registrationEnd: null,
        startTime: "2026-06-01T09:00:00.000Z",
        endTime: "2026-06-01T10:30:00.000Z",
        durationMinutes: 90,
        attemptsAllowed: 1,
        multiAttemptGradingMode: "highest_score",
        maxParticipants: 30,
        participantsPerTeam: null,
        maxTeams: null,
        scoringMode: "difficulty",
        customPointsByProblemId: {},
        penaltyMode: "fixed_deduction",
        tieBreaker: "lowest_total_time",
        shuffleQuestions: false,
        shuffleOptions: false,
        logTabSwitch: false,
        offensePenalties: [],
        answerKeyVisibility: "after_end",
        deductionValue: 1,
        selectedProblemIds: [],
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.name).toBe("Modern Draft Updated");
  });

  test("patch re-reads updated competition when legacy save fallback returns no row", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [
            {
              data: buildCompetitionRow(),
              error: null,
            },
            {
              data: buildCompetitionRow({
                name: "Legacy Draft Updated",
                draft_revision: 2,
                updated_at: "2026-04-02T00:00:00.000Z",
              }),
              error: null,
            },
          ],
        },
        selectedProblemIds: ["problem-1"],
      }) as never,
    );

    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };
    updateQuery.eq.mockImplementation(() => updateQuery);
    updateQuery.select.mockImplementation(() => updateQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            update: vi.fn(() => updateQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42883",
          message: "function public.save_competition_draft(uuid, integer, jsonb) does not exist",
        },
      }),
    } as never);

    const response = await PATCH(
      makePatchRequest({
        name: "Legacy Draft Updated",
        description: "Legacy save coverage",
        instructions: "Read carefully.",
        type: "scheduled",
        format: "individual",
        registrationTimingMode: "default",
        registrationStart: null,
        registrationEnd: null,
        startTime: "2026-06-01T09:00:00.000Z",
        endTime: "2026-06-01T10:30:00.000Z",
        durationMinutes: 90,
        attemptsAllowed: 1,
        multiAttemptGradingMode: "highest_score",
        maxParticipants: 30,
        participantsPerTeam: null,
        maxTeams: null,
        scoringMode: "difficulty",
        customPointsByProblemId: {},
        penaltyMode: "fixed_deduction",
        deductionValue: 1,
        tieBreaker: "lowest_total_time",
        shuffleQuestions: false,
        shuffleOptions: false,
        logTabSwitch: false,
        offensePenalties: [],
        answerKeyVisibility: "after_end",
        selectedProblemIds: ["problem-1"],
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.name).toBe("Legacy Draft Updated");
    expect(body.currentDraftRevision).toBe(2);
  });

  test("delete falls back to legacy soft delete when lifecycle RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [{ data: buildCompetitionRow(), error: null }],
        },
      }) as never,
    );

    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: COMPETITION_ID },
        error: null,
      }),
    };
    updateQuery.eq.mockImplementation(() => updateQuery);
    updateQuery.select.mockImplementation(() => updateQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42883",
          message: "function public.delete_draft_competition(uuid, text) does not exist",
        },
      }),
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            update: vi.fn(() => updateQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.machineCode).toBe("ok");
    expect(body.isDeleted).toBe(true);
  });

  test("delete falls back to legacy competition reads when primary read returns no data", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [{ data: null, error: null }],
          [LEGACY_COMPETITION_SELECT_COLUMNS]: [{ data: buildLegacyCompetitionRow(), error: null }],
        },
      }) as never,
    );

    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: COMPETITION_ID },
        error: null,
      }),
    };
    updateQuery.eq.mockImplementation(() => updateQuery);
    updateQuery.select.mockImplementation(() => updateQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42883",
          message: "function public.delete_draft_competition(uuid, text) does not exist",
        },
      }),
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            update: vi.fn(() => updateQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.machineCode).toBe("ok");
    expect(body.isDeleted).toBe(true);
  });

  test("delete treats empty lifecycle payload as success when mutation already completed", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [{ data: buildCompetitionRow(), error: null }],
        },
      }) as never,
    );

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
      from: vi.fn(),
    } as never);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.machineCode).toBe("ok");
    expect(body.isDeleted).toBe(true);
  });

  test("delete treats unshaped lifecycle payload as success when mutation already completed", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [{ data: buildCompetitionRow(), error: null }],
        },
      }) as never,
    );

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: { ok: true },
        error: null,
      }),
      from: vi.fn(),
    } as never);

    const response = await DELETE(makeDeleteRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.machineCode).toBe("ok");
    expect(body.isDeleted).toBe(true);
  });
});
