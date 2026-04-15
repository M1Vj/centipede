import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST as startCompetition } from "@/app/api/organizer/competitions/[competitionId]/start/route";
import { POST as endCompetition } from "@/app/api/organizer/competitions/[competitionId]/end/route";
import { POST as archiveCompetition } from "@/app/api/organizer/competitions/[competitionId]/archive/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const ORGANIZER_ID = "organizer-1";
const COMPETITION_ID = "competition-1";

type MockStatus = "draft" | "published" | "live" | "paused" | "ended" | "archived";

function makeCompetitionRow(status: MockStatus) {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Branch 08 Competition",
    description: "",
    instructions: "",
    type: "open",
    format: "individual",
    status,
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
    published: status !== "draft",
    is_paused: status === "paused",
    created_at: "2026-04-15T00:00:00.000Z",
  };
}

function makeMutationRequest(path: "start" | "end" | "archive") {
  return new Request(`http://localhost:3000/api/organizer/competitions/${COMPETITION_ID}/${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "x-idempotency-key": "idem-token-123",
    },
  });
}

function makeCrossSiteMutationRequest(path: "start" | "end" | "archive") {
  return new Request(`http://localhost:3000/api/organizer/competitions/${COMPETITION_ID}/${path}`, {
    method: "POST",
    headers: {
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
    from,
  };
}

describe("lifecycle route legacy fallback compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("start route allows idempotent replay responses from lifecycle RPC", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("live"), makeCompetitionRow("live")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: {
        machine_code: "ok",
        status: "live",
        event_id: "event-1",
        request_idempotency_token: "idem-token-123",
        replayed: true,
        changed: false,
      },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
    } as never);

    const response = await startCompetition(makeMutationRequest("start"), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.status).toBe("live");
    expect(body.lifecycle.replayed).toBe(true);
    expect(body.lifecycle.changed).toBe(false);
    expect(rpc).toHaveBeenCalledWith("start_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
    });
  });

  test("start route falls back and persists transition when lifecycle RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("published"), makeCompetitionRow("live")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.start_competition in the schema cache",
      },
    });

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
    const competitionsUpdate = vi.fn().mockImplementation(() => updateQuery);

    const from = vi.fn((table: string) => {
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

    const response = await startCompetition(makeMutationRequest("start"), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("live");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.status).toBe("live");
    expect(competitionsUpdate).toHaveBeenCalledWith({
      status: "live",
      published: true,
      is_paused: false,
    });
    expect(rpc).toHaveBeenCalledWith("start_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
    });
  });

  test("end route falls back and persists transition when lifecycle RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("live"), makeCompetitionRow("ended")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.end_competition in the schema cache",
      },
    });

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
    const competitionsUpdate = vi.fn().mockImplementation(() => updateQuery);

    const from = vi.fn((table: string) => {
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

    const response = await endCompetition(makeMutationRequest("end"), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("ended");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.status).toBe("ended");
    expect(competitionsUpdate).toHaveBeenCalledWith({
      status: "ended",
      published: true,
      is_paused: false,
    });
    expect(rpc).toHaveBeenCalledWith("end_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
      p_reason: "manual",
      p_transition_source: "trusted_manual_action",
    });
  });

  test("archive route falls back and persists transition when lifecycle RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("ended"), makeCompetitionRow("archived")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.archive_competition in the schema cache",
      },
    });

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
    const competitionsUpdate = vi.fn().mockImplementation(() => updateQuery);

    const from = vi.fn((table: string) => {
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

    const response = await archiveCompetition(makeMutationRequest("archive"), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.code).toBe("ok");
    expect(body.competition.status).toBe("archived");
    expect(body.lifecycle.machineCode).toBe("ok");
    expect(body.lifecycle.status).toBe("archived");
    expect(competitionsUpdate).toHaveBeenCalledWith({
      status: "archived",
      published: true,
      is_paused: false,
    });
    expect(rpc).toHaveBeenCalledWith("archive_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
    });
  });

  test("returns service unavailable when fallback cannot persist lifecycle state", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("published")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.start_competition in the schema cache",
      },
    });

    const updateQuery = {
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42703",
          message: "column competitions.status does not exist",
        },
      }),
    };
    updateQuery.eq.mockImplementation(() => updateQuery);
    updateQuery.select.mockImplementation(() => updateQuery);

    const from = vi.fn((table: string) => {
      if (table === "competitions") {
        return {
          update: vi.fn().mockImplementation(() => updateQuery),
        };
      }

      throw new Error(`Unexpected table in admin client: ${table}`);
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
      from,
    } as never);

    const response = await startCompetition(makeMutationRequest("start"), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("service_unavailable");
    expect(body.changed).toBe(false);
  });

  test("blocks cross-site mutation requests before auth resolution", async () => {
    const response = await startCompetition(makeCrossSiteMutationRequest("start"), {
      params: Promise.resolve({ competitionId: COMPETITION_ID }),
    });
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden");
    expect(createClient).not.toHaveBeenCalled();
  });
});
