import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST as disputeRoute } from "@/app/api/mathlete/competition/[competitionId]/disputes/route";
import { createClient } from "@/lib/supabase/server";
import { createProblemDispute } from "@/lib/submission/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/submission/server", () => ({
  createProblemDispute: vi.fn(),
}));

const COMPETITION_ID = "competition-1";
const MATHLETE_ID = "mathlete-1";

function makeMathleteClient() {
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: {
        id: MATHLETE_ID,
        role: "mathlete",
        is_active: true,
      },
      error: null,
    }),
  };

  profileQuery.select.mockImplementation(() => profileQuery);
  profileQuery.eq.mockImplementation(() => profileQuery);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: MATHLETE_ID },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return profileQuery;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeRequest(body: Record<string, unknown>, withOrigin = true) {
  return new Request(`http://localhost:3000/api/mathlete/competition/${COMPETITION_ID}/disputes`, {
    method: "POST",
    headers: withOrigin
      ? {
          origin: "http://localhost:3000",
          "x-forwarded-host": "localhost:3000",
          "content-type": "application/json",
        }
      : {
          "content-type": "application/json",
        },
    body: JSON.stringify(body),
  });
}

describe("submission dispute route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects cross-site dispute mutation requests", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);

    const response = await disputeRoute(
      makeRequest(
        {
          competitionProblemId: "cp-1",
          attemptId: "attempt-1",
          reason: "Answer key looks wrong.",
        },
        false,
      ),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );

    expect(response.status).toBe(403);
    expect(createProblemDispute).not.toHaveBeenCalled();
  });

  test("creates participant dispute through trusted helper", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(createProblemDispute).mockResolvedValue({
      machine_code: "ok",
      dispute_id: "dispute-1",
      status: "open",
      replayed: false,
    } as never);

    const response = await disputeRoute(
      makeRequest({
        competitionProblemId: "cp-1",
        attemptId: "attempt-1",
        reason: "Answer key looks wrong.",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.machineCode).toBe("ok");
    expect(createProblemDispute).toHaveBeenCalledWith({
      competitionId: COMPETITION_ID,
      competitionProblemId: "cp-1",
      attemptId: "attempt-1",
      reporterId: MATHLETE_ID,
      reason: "Answer key looks wrong.",
    });
  });

  test("returns actionable message when dispute rate limit is hit", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(createProblemDispute).mockResolvedValue({
      machine_code: "dispute_rate_limited",
      dispute_id: null,
      status: null,
      replayed: false,
    } as never);

    const response = await disputeRoute(
      makeRequest({
        competitionProblemId: "cp-2",
        attemptId: "attempt-1",
        reason: "Second answer key issue.",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.code).toBe("dispute_rate_limited");
    expect(body.message).toBe("Please wait before submitting another dispute for this problem.");
    expect(body.machineCode).toBe("dispute_rate_limited");
  });

  test("returns permission message when dispute target is outside participant context", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(createProblemDispute).mockResolvedValue({
      machine_code: "forbidden",
      dispute_id: null,
      status: null,
      replayed: false,
    } as never);

    const response = await disputeRoute(
      makeRequest({
        competitionProblemId: "cp-other",
        attemptId: "attempt-other",
        reason: "This answer key does not match.",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden");
    expect(body.message).toBe("You can only dispute problems from your own completed attempt.");
    expect(body.machineCode).toBe("forbidden");
  });

  test("returns answer-key visibility message when disputes are not open yet", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(createProblemDispute).mockResolvedValue({
      machine_code: "competition_not_ended",
      dispute_id: null,
      status: null,
      replayed: false,
    } as never);

    const response = await disputeRoute(
      makeRequest({
        competitionProblemId: "cp-early",
        attemptId: "attempt-early",
        reason: "This answer key is not ready.",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("competition_not_ended");
    expect(body.message).toBe("Disputes open only after the answer key is visible for your completed attempt.");
    expect(body.machineCode).toBe("competition_not_ended");
  });
});
