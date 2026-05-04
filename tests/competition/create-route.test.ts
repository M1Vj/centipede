import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/organizer/competitions/route";
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

function makeCreateRequest(payload: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/organizer/competitions", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

function makeServerClient(
  accessibleProblemIds: string[] = [],
  options: {
    competitionSelectResults?: Partial<
      Record<
        typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS,
        { data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }
      >
    >;
  } = {},
) {
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

  let requestedProblemIds: string[] = [];
  const problemsQuery = {
    in: vi.fn((_: string, ids: string[]) => {
      requestedProblemIds = ids.filter((id): id is string => typeof id === "string");
      return problemsQuery;
    }),
    eq: vi.fn().mockImplementation(async () => ({
      data: accessibleProblemIds
        .filter((problemId) => requestedProblemIds.includes(problemId))
        .map((id) => ({ id })),
      error: null,
    })),
  };

  const problemsTable = {
    select: vi.fn(() => problemsQuery),
  };

  function makeCompetitionMaybeSingle(
    columns: typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS,
  ) {
    return {
      eq: vi.fn().mockImplementation(() => makeCompetitionMaybeSingle(columns)),
      maybeSingle: vi
        .fn()
        .mockResolvedValue(
          options.competitionSelectResults?.[columns] ?? {
            data: null,
            error: null,
          },
        ),
    };
  }

  const competitionsTable = {
    select: vi.fn((columns: typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS) =>
      makeCompetitionMaybeSingle(columns),
    ),
  };

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

      if (table === "problems") {
        return problemsTable;
      }

      if (table === "competitions") {
        return competitionsTable;
      }

      throw new Error(`Unexpected table in server client: ${table}`);
    }),
  };
}

function buildCompetitionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "competition-1",
    organizer_id: ORGANIZER_ID,
    name: "Spring Invitational",
    description: "Open registration until start.",
    instructions: "Bring your own paper.",
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
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function buildLegacyCompetitionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "competition-1",
    organizer_id: ORGANIZER_ID,
    name: "Spring Invitational",
    description: "Open registration until start.",
    instructions: "Bring your own paper.",
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
    ...overrides,
  };
}

function buildScheduledCreatePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    name: "Spring Invitational",
    description: "Open registration until start.",
    instructions: "Bring your own paper.",
    type: "scheduled",
    format: "individual",
    registrationTimingMode: "default",
    registrationStart: null,
    registrationEnd: null,
    startTime: "2026-06-01T09:00:00.000Z",
    endTime: null,
    durationMinutes: 90,
    attemptsAllowed: 1,
    multiAttemptGradingMode: "highest_score",
    maxParticipants: 30,
    participantsPerTeam: null,
    maxTeams: null,
    scoringMode: "difficulty",
    customPointsByProblemId: {},
    penaltyMode: "none",
    deductionValue: 0,
    tieBreaker: "earliest_final_submission",
    shuffleQuestions: false,
    shuffleOptions: false,
    logTabSwitch: false,
    offensePenalties: [],
    answerKeyVisibility: "after_end",
    selectedProblemIds: [],
    ...overrides,
  };
}

describe("POST /api/organizer/competitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns structured validation errors when manual registration is missing required fields", async () => {
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          registrationTimingMode: "manual",
          registrationStart: "",
          registrationEnd: "",
        }),
      ),
    );

    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("validation_failed");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "registrationStart" }),
        expect.objectContaining({ field: "registrationEnd" }),
      ]),
    );
  });

  test("creates scheduled draft in default timing mode with registration end aligned to competition start", async () => {
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    let insertedPayload: Record<string, unknown> | null = null;
    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    const competitionsTable = {
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertedPayload = payload;
        return insertQuery;
      }),
    };

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return competitionsTable;
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await POST(makeCreateRequest(buildScheduledCreatePayload()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(insertedPayload?.registration_start).toBeNull();
    expect(insertedPayload?.registration_end).toBe("2026-06-01T09:00:00.000Z");
  });

  test("returns structured duplicate-name field error", async () => {
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "23505",
          message: "duplicate key value violates unique constraint",
        },
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn(() => ({
        insert: vi.fn(() => insertQuery),
      })),
    } as never);

    const response = await POST(makeCreateRequest(buildScheduledCreatePayload()));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("duplicate_name");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "name",
          reason: "A competition with this name already exists.",
        }),
      ]),
    );
  });

  test("maps non-ok lifecycle machine code to status, message, and structured form error payload", async () => {
    vi.mocked(createClient).mockResolvedValue(makeServerClient(["problem-1"]) as never);

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ machine_code: "draft_write_conflict", selected_problem_count: 1 }],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: rpcMock,
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("draft_write_conflict");
    expect(body.message).toBe("Draft changed elsewhere. Refresh and try again.");
    expect(body.machineCode).toBe("draft_write_conflict");
    expect(body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "form",
          reason: "Draft changed elsewhere. Refresh and try again.",
        }),
      ]),
    );

    expect(rpcMock).toHaveBeenCalledWith(
      "save_competition_draft",
      expect.objectContaining({
        p_competition_id: "competition-1",
      }),
    );
  });

  test("falls back to legacy competition select columns after legacy-schema insert response", async () => {
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    const insertPayloads: Array<Record<string, unknown>> = [];
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "42703",
          message: 'column competitions.status does not exist',
        },
      })
      .mockResolvedValueOnce({
        data: buildLegacyCompetitionRow(),
        error: null,
      });
    const select = vi.fn((columns: string) => ({
      single: vi.fn(() => single()),
      __columns: columns,
    }));

    const competitionsTable = {
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertPayloads.push(payload);
        return {
          select,
        };
      }),
    };

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return competitionsTable;
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const offensePenalties = [{ threshold: 2, penaltyKind: "warning", deductionValue: 0 }];
    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          type: "open",
          startTime: null,
          logTabSwitch: true,
          offensePenalties,
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(select).toHaveBeenNthCalledWith(1, COMPETITION_SELECT_COLUMNS);
    expect(select).toHaveBeenNthCalledWith(2, LEGACY_COMPETITION_SELECT_COLUMNS);
    expect(insertPayloads).toHaveLength(2);
    expect(insertPayloads[1]).not.toHaveProperty("offense_penalties_json");
    expect(insertPayloads[1]).toEqual(
      expect.objectContaining({
        log_tab_switch: true,
        offense_penalties: offensePenalties,
      }),
    );
  });

  test("re-reads created competition when insert returns no row data", async () => {
    vi.mocked(createClient).mockResolvedValue(makeServerClient() as never);

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    const lookupQuery = {
      eq: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: buildCompetitionRow(),
        error: null,
      }),
    };
    lookupQuery.eq.mockImplementation(() => lookupQuery);

    const competitionsTable = {
      insert: vi.fn(() => insertQuery),
      select: vi.fn(() => lookupQuery),
    };

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return competitionsTable;
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await POST(makeCreateRequest(buildScheduledCreatePayload()));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.competition.id).toBe("competition-1");
    expect(lookupQuery.maybeSingle).toHaveBeenCalled();
  });

  test("re-reads created competition when save draft returns empty lifecycle result", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: buildCompetitionRow({
              draft_revision: 7,
              updated_at: "2026-04-02T00:00:00.000Z",
            }),
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.selectedProblemCount).toBe(1);
    expect(body.currentDraftRevision).toBe(7);
    expect(body.competition.draftRevision).toBe(7);
    expect(body.competition.id).toBe("competition-1");
  });

  test("re-reads created competition when save draft returns unshaped lifecycle row", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: buildCompetitionRow({
              draft_revision: 8,
              updated_at: "2026-04-03T00:00:00.000Z",
            }),
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ selected_problem_count: 1, current_draft_revision: 8 }],
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.selectedProblemCount).toBe(1);
    expect(body.currentDraftRevision).toBe(8);
    expect(body.competition.draftRevision).toBe(8);
    expect(body.competition.id).toBe("competition-1");
  });

  test("re-reads created competition when save draft returns operation_failed lifecycle code", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: buildCompetitionRow({
              draft_revision: 9,
              updated_at: "2026-04-04T00:00:00.000Z",
            }),
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ machine_code: "operation_failed", selected_problem_count: 1, current_draft_revision: 9 }],
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.selectedProblemCount).toBe(1);
    expect(body.currentDraftRevision).toBe(9);
    expect(body.competition.draftRevision).toBe(9);
    expect(body.competition.id).toBe("competition-1");
  });

  test("serializes modern scoring tokens before save and refreshes created draft", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: buildCompetitionRow(),
            error: null,
          },
        },
      }) as never,
    );

    let insertedPayload: Record<string, unknown> | null = null;
    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow(),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    const rpcMock = vi.fn().mockResolvedValue({
      data: [{ machine_code: "ok", selected_problem_count: 1, current_draft_revision: 2 }],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn((payload: Record<string, unknown>) => {
              insertedPayload = payload;
              return insertQuery;
            }),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: rpcMock,
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
          scoringMode: "difficulty",
          penaltyMode: "fixed_deduction",
          deductionValue: 1,
          tieBreaker: "lowest_total_time",
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(insertedPayload?.scoring_mode).toBe("automatic");
    expect(insertedPayload?.penalty_mode).toBe("deduction");
    expect(insertedPayload?.tie_breaker).toBe("average_time");
    expect(rpcMock).toHaveBeenCalledWith(
      "save_competition_draft",
      expect.objectContaining({
        p_payload_json: expect.objectContaining({
          scoringMode: "automatic",
          penaltyMode: "deduction",
          tieBreaker: "average_time",
        }),
      }),
    );
    expect(body.competition.status).toBe("draft");
    expect(body.currentDraftRevision).toBe(2);
  });

  test("falls back to legacy competition select columns when primary post-save read returns no data", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: null,
            error: null,
          },
          [LEGACY_COMPETITION_SELECT_COLUMNS]: {
            data: buildLegacyCompetitionRow(),
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow(),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ machine_code: "ok", selected_problem_count: 1, current_draft_revision: 2 }],
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.competition.status).toBe("draft");
    expect(body.currentDraftRevision).toBe(2);
  });

  test("keeps created draft successful when post-save refresh is unavailable under schema drift", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: null,
            error: {
              code: "42703",
              message: "column competitions.status does not exist",
            },
          },
          [LEGACY_COMPETITION_SELECT_COLUMNS]: {
            data: null,
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow(),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ machine_code: "ok", selected_problem_count: 1, current_draft_revision: 2 }],
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.competition.status).toBe("draft");
    expect(body.currentDraftRevision).toBe(2);
  });

  test("re-reads created competition when save draft returns unshaped lifecycle payload", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: buildCompetitionRow({
              draft_revision: 8,
              updated_at: "2026-04-03T00:00:00.000Z",
            }),
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow(),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ competition_id: "competition-1" }],
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.competition.status).toBe("draft");
    expect(body.currentDraftRevision).toBe(8);
    expect(body.selectedProblemCount).toBe(1);
  });

  test("falls back to inserted competition when post-save readback returns a generic database error", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: null,
            error: {
              code: "XX000",
              message: "backend readback failure",
            },
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ machine_code: "operation_failed", selected_problem_count: 1, current_draft_revision: 9 }],
        error: null,
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.code).toBe("created");
    expect(body.competition.id).toBe("competition-1");
    expect(body.selectedProblemCount).toBe(1);
    expect(body.currentDraftRevision).toBe(9);
  });

  test("returns database error when save draft returns a generic rpc error", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeServerClient(["problem-1"], {
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: {
            data: buildCompetitionRow({
              draft_revision: 9,
              updated_at: "2026-04-04T00:00:00.000Z",
            }),
            error: null,
          },
        },
      }) as never,
    );

    const insertQuery = {
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({
        data: buildCompetitionRow({
          draft_revision: 9,
          updated_at: "2026-04-04T00:00:00.000Z",
        }),
        error: null,
      }),
    };
    insertQuery.select.mockImplementation(() => insertQuery);

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return {
            insert: vi.fn(() => insertQuery),
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "XX000",
          message: "generic rpc failure",
        },
      }),
    } as never);

    const response = await POST(
      makeCreateRequest(
        buildScheduledCreatePayload({
          selectedProblemIds: ["problem-1"],
        }),
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("operation_failed");
    expect(body.message).toBe("Operation could not be completed.");
  });
});
