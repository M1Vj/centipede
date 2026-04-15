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

  test("start route falls back when lifecycle RPC is unavailable", async () => {
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

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
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
    expect(rpc).toHaveBeenCalledWith("start_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
    });
  });

  test("end route falls back when lifecycle RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("published")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.end_competition in the schema cache",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
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
    expect(rpc).toHaveBeenCalledWith("end_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
      p_reason: "manual",
      p_transition_source: "trusted_manual_action",
    });
  });

  test("archive route falls back when lifecycle RPC is unavailable", async () => {
    vi.mocked(createClient).mockResolvedValue(
      makeSupabaseClient([makeCompetitionRow("ended")]) as never,
    );

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message: "Could not find the function public.archive_competition in the schema cache",
      },
    });

    vi.mocked(createAdminClient).mockReturnValue({
      rpc,
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
    expect(rpc).toHaveBeenCalledWith("archive_competition", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
    });
  });
});
