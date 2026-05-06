import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST as submitRoute } from "@/app/api/mathlete/competition/[competitionId]/submit/route";
import { createClient } from "@/lib/supabase/server";
import { submitCompetitionAttempt } from "@/lib/arena/server";
import { loadReviewSubmissionPageData } from "@/lib/submission/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/arena/server", () => ({
  submitCompetitionAttempt: vi.fn(),
}));

vi.mock("@/lib/submission/server", () => ({
  loadReviewSubmissionPageData: vi.fn(),
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
  return new Request(`http://localhost:3000/api/mathlete/competition/${COMPETITION_ID}/submit`, {
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

describe("submission submit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns review-submission payload after trusted submit", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(submitCompetitionAttempt).mockResolvedValue({
      machine_code: "ok",
    } as never);
    vi.mocked(loadReviewSubmissionPageData).mockResolvedValue({
      competition: {
        id: COMPETITION_ID,
        name: "Branch 13",
        type: "open",
        status: "live",
        attemptsAllowed: 2,
        multiAttemptGradingMode: "highest_score",
      },
      attempt: {
        id: "attempt-1",
        attemptNo: 1,
        status: "submitted",
        submittedAt: "2026-05-06T00:00:00.000Z",
        finalScore: 0,
        rawScore: 0,
        penaltyScore: 0,
        gradedAt: null,
      },
      attemptsRemaining: 1,
      summaryCounts: {
        total: 1,
        blank: 0,
        filled: 1,
        solved: 0,
        reset: 0,
      },
      problems: [],
    } as never);

    const response = await submitRoute(
      makeRequest({ attemptId: "attempt-1" }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.machineCode).toBe("ok");
    expect(body.data.attempt.status).toBe("submitted");
    expect(body.data.attemptsRemaining).toBe(1);
    expect(loadReviewSubmissionPageData).toHaveBeenCalledWith(COMPETITION_ID, MATHLETE_ID, "attempt-1");
  });

  test("returns structured json when trusted submit RPC throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
      vi.mocked(submitCompetitionAttempt).mockRejectedValue(new Error("column reference attempt_id is ambiguous"));

      const response = await submitRoute(
        makeRequest({ attemptId: "attempt-1" }),
        { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
      );
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.code).toBe("submit_failed");
      expect(body.machineCode).toBe("rpc_error");
      expect(body.message).toMatch(/grading service/i);
      expect(loadReviewSubmissionPageData).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
