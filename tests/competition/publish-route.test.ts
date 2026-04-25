import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/organizer/competitions/[competitionId]/publish/route";
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

function makeCompetitionRow(status: "draft" | "published") {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Branch 08 Competition",
    description: "",
    instructions: "",
    type: "open",
    format: "individual",
    registration_start: null,
    registration_end: null,
    start_time: null,
    duration_minutes: 60,
    attempts_allowed: 1,
    max_participants: 20,
    participants_per_team: null,
    max_teams: null,
    scoring_mode: "automatic",
    custom_points: {},
    penalty_mode: "none",
    deduction_value: 0,
    tie_breaker: "earliest_submission",
    shuffle_questions: false,
    shuffle_options: false,
    log_tab_switch: false,
    offense_penalties: [],
    published: status === "published",
    is_paused: false,
    created_at: "2026-04-15T00:00:00.000Z",
  };
}

function makeLegacyCompetitionRow(status: "draft" | "published") {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Branch 08 Competition",
    description: "",
    instructions: "",
    type: "open",
    format: "individual",
    registration_start: null,
    registration_end: null,
    start_time: null,
    duration_minutes: 60,
    attempts_allowed: 1,
    max_participants: 20,
    participants_per_team: null,
    max_teams: null,
    scoring_mode: "automatic",
    custom_points: {},
    penalty_mode: "none",
    deduction_value: 0,
    tie_breaker: "earliest_submission",
    shuffle_questions: false,
    shuffle_options: false,
    log_tab_switch: false,
    offense_penalties: [],
    published: status === "published",
    is_paused: false,
    created_at: "2026-04-15T00:00:00.000Z",
    updated_at: "2026-04-15T00:00:00.000Z",
  };
}

function makePublishRequest() {
  return new Request(`http://localhost:3000/api/organizer/competitions/${COMPETITION_ID}/publish`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "x-idempotency-key": "idem-token-123",
    },
  });
}

function makeSupabaseClient(competitionRows: Array<Record<string, unknown>>) {
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

  const competitionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  competitionQuery.select.mockImplementation(() => competitionQuery);
  competitionQuery.eq.mockImplementation(() => competitionQuery);
  for (const row of competitionRows) {
    competitionQuery.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
  }

  const from = vi.fn((table: string) => {
    if (table === "profiles") {
      return profileQuery;
    }

    if (table === "competitions") {
      return competitionQuery;
    }

    throw new Error(`Unexpected table in server client: ${table}`);
  });

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: ORGANIZER_ID,
          },
        },
      }),
    },
    from,
  };

  return {
    client,
    competitionQuery,
  };
}

function makeQueuedSelectClient(options: {
  competitionSelectResults: Partial<
    Record<
      typeof COMPETITION_SELECT_COLUMNS | typeof LEGACY_COMPETITION_SELECT_COLUMNS,
      Array<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>
    >
  >;
}) {
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

  const queues = new Map(
    Object.entries(options.competitionSelectResults).map(([columns, results]) => [columns, [...results]]),
  );

  function makeCompetitionMaybeSingle(columns: string) {
    return {
      eq: vi.fn().mockImplementation(() => makeCompetitionMaybeSingle(columns)),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const queue = queues.get(columns) ?? [];
        const next = queue.shift() ?? { data: null, error: null };
        queues.set(columns, queue);
        return next;
      }),
    };
  }

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
          select: vi.fn((columns: string) => makeCompetitionMaybeSingle(columns)),
        };
      }

      throw new Error(`Unexpected table in server client: ${table}`);
    }),
  };
}

function makeLegacySelectFallbackSupabaseClient() {
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

  const queues = new Map<string, Array<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>>([
    [
      COMPETITION_SELECT_COLUMNS,
      [
        {
          data: null,
          error: { code: "42703", message: "column competitions.status does not exist" },
        },
        {
          data: null,
          error: { code: "42703", message: "column competitions.status does not exist" },
        },
      ],
    ],
    [
      LEGACY_COMPETITION_SELECT_COLUMNS,
      [
        { data: makeLegacyCompetitionRow("draft"), error: null },
        { data: makeLegacyCompetitionRow("published"), error: null },
      ],
    ],
  ]);

  function makeCompetitionMaybeSingle(columns: string) {
    return {
      eq: vi.fn().mockImplementation(() => makeCompetitionMaybeSingle(columns)),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const queue = queues.get(columns) ?? [];
        const next = queue.shift() ?? { data: null, error: null };
        queues.set(columns, queue);
        return next;
      }),
    };
  }

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
          select: vi.fn((columns: string) => makeCompetitionMaybeSingle(columns)),
        };
      }

      throw new Error(`Unexpected table in server client: ${table}`);
    }),
  };
}

function makeNullPrimaryReadFallbackSupabaseClient() {
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

  const queues = new Map<string, Array<{ data: Record<string, unknown> | null; error: { code?: string; message?: string } | null }>>([
    [
      COMPETITION_SELECT_COLUMNS,
      [
        { data: null, error: null },
        { data: null, error: null },
      ],
    ],
    [
      LEGACY_COMPETITION_SELECT_COLUMNS,
      [
        { data: makeLegacyCompetitionRow("draft"), error: null },
        { data: makeLegacyCompetitionRow("published"), error: null },
      ],
    ],
  ]);

  function makeCompetitionMaybeSingle(columns: string) {
    return {
      eq: vi.fn().mockImplementation(() => makeCompetitionMaybeSingle(columns)),
      maybeSingle: vi.fn().mockImplementation(async () => {
        const queue = queues.get(columns) ?? [];
        const next = queue.shift() ?? { data: null, error: null };
        queues.set(columns, queue);
        return next;
      }),
    };
  }

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
          select: vi.fn((columns: string) => makeCompetitionMaybeSingle(columns)),
        };
      }

      throw new Error(`Unexpected table in server client: ${table}`);
    }),
  };
}

describe("publish route compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("falls back to legacy publish update when lifecycle RPC is unavailable", async () => {
    const supabase = makeSupabaseClient([
      makeCompetitionRow("draft"),
      makeCompetitionRow("published"),
    ]);
    vi.mocked(createClient).mockResolvedValue(supabase.client as never);

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.publish_competition(uuid, text) does not exist",
      },
    });

    const competitionProblemsCountEq = vi.fn().mockResolvedValue({ count: 10, error: null });
    const competitionProblemsSelect = vi.fn().mockImplementation(() => ({
      eq: competitionProblemsCountEq,
    }));

    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: COMPETITION_ID,
        },
        error: null,
      }),
    };
    updateQuery.eq.mockImplementation(() => updateQuery);
    updateQuery.select.mockImplementation(() => updateQuery);

    const competitionsUpdate = vi.fn().mockImplementation(() => updateQuery);

    const from = vi.fn((table: string) => {
      if (table === "competition_problems") {
        return {
          select: competitionProblemsSelect,
        };
      }

      if (table === "competitions") {
        return {
          update: competitionsUpdate,
        };
      }

      throw new Error(`Unexpected table in admin client: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
      from,
    } as never);

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.selectedProblemCount).toBe(10);
    expect(rpc).toHaveBeenCalledWith("publish_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
    });
    expect(competitionsUpdate).toHaveBeenCalledWith({
      published: true,
      is_paused: false,
    });
  });

  test("accepts scalar lifecycle RPC payloads without triggering fallback", async () => {
    const supabase = makeSupabaseClient([
      makeCompetitionRow("draft"),
      makeCompetitionRow("published"),
    ]);
    vi.mocked(createClient).mockResolvedValue(supabase.client as never);

    const rpc = vi.fn().mockResolvedValue({
      data: ["ok"],
      error: null,
    });

    const from = vi.fn(() => {
      throw new Error("Legacy fallback should not execute for successful RPC payloads");
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
      from,
    } as never);

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.requestIdempotencyToken).toBe("");
    expect(from).not.toHaveBeenCalled();
  });

  test("keeps publish successful when lifecycle RPC returns unshaped payload", async () => {
    const supabase = makeSupabaseClient([
      makeCompetitionRow("draft"),
      makeCompetitionRow("published"),
    ]);
    vi.mocked(createClient).mockResolvedValue(supabase.client as never);

    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true },
      error: null,
    });

    const competitionProblemsQuery = {
      eq: vi.fn(),
    };
    competitionProblemsQuery.eq.mockResolvedValue({ count: 10, error: null });
    const competitionProblemsSelect = vi.fn().mockImplementation(() => ({
      eq: vi.fn().mockReturnValue(competitionProblemsQuery),
    }));

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "competition_problems") {
          return {
            select: competitionProblemsSelect,
          };
        }

        throw new Error(`Unexpected table in admin client: ${table}`);
      }),
    } as never);

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.selectedProblemCount).toBe(0);
  });

  test("falls back to legacy competition reads when modern competition columns are unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(makeLegacySelectFallbackSupabaseClient() as never);

    const rpc = vi.fn().mockResolvedValue({
      data: ["ok"],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
      from: vi.fn(),
    } as never);

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
  });

  test("falls back to legacy competition reads when primary read returns no data", async () => {
    vi.mocked(createClient).mockResolvedValue(makeNullPrimaryReadFallbackSupabaseClient() as never);

    const rpc = vi.fn().mockResolvedValue({
      data: ["ok"],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
      from: vi.fn(),
    } as never);

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
  });

  test("keeps publish successful when lifecycle payload is missing and refresh is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeQueuedSelectClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [
            { data: makeCompetitionRow("draft"), error: null },
            {
              data: null,
              error: {
                code: "42703",
                message: "column competitions.status does not exist",
              },
            },
          ],
          [LEGACY_COMPETITION_SELECT_COLUMNS]: [
            { data: makeLegacyCompetitionRow("draft"), error: null },
            { data: null, error: null },
          ],
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

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
  });

  test("keeps publish status published when refresh returns stale row after ok lifecycle", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeQueuedSelectClient({
        competitionSelectResults: {
          [COMPETITION_SELECT_COLUMNS]: [
            { data: makeCompetitionRow("draft"), error: null },
            { data: makeCompetitionRow("draft"), error: null },
          ],
        },
      }) as never,
    );

    vi.mocked(createAdminClient).mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        data: ["ok"],
        error: null,
      }),
      from: vi.fn(),
    } as never);

    const response = await POST(makePublishRequest(), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("published");
    expect(body.lifecycle.machineCode).toBe("ok");
  });
});
