import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST as answerRoute } from "@/app/api/mathlete/competition/[competitionId]/answer/route";
import { POST as closeRoute } from "@/app/api/mathlete/competition/[competitionId]/close/route";
import { POST as startRoute } from "@/app/api/mathlete/competition/[competitionId]/start/route";
import { createClient } from "@/lib/supabase/server";
import {
  closeActiveAttemptInterval,
  loadArenaPageData,
  saveArenaAnswer,
  startCompetitionAttempt,
} from "@/lib/arena/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/arena/server", () => ({
  closeActiveAttemptInterval: vi.fn(),
  loadArenaPageData: vi.fn(),
  saveArenaAnswer: vi.fn(),
  startCompetitionAttempt: vi.fn(),
}));

const MATHLETE_ID = "mathlete-1";
const COMPETITION_ID = "competition-1";

function makeMathleteClient(options?: { userId?: string | null; role?: string; isActive?: boolean }) {
  const userId = options && "userId" in options ? options.userId : MATHLETE_ID;
  const role = options?.role ?? "mathlete";
  const isActive = options?.isActive ?? true;

  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: userId
        ? {
            id: userId,
            role,
            is_active: isActive,
          }
        : null,
      error: null,
    }),
  };

  profileQuery.select.mockImplementation(() => profileQuery);
  profileQuery.eq.mockImplementation(() => profileQuery);

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
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

function makeMutationRequest(path: string, body: Record<string, unknown>, withOrigin = true) {
  return new Request(`http://localhost:3000${path}`, {
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

describe("arena mutation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("answer route rejects cross-site mutation requests", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);

    const response = await answerRoute(
      makeMutationRequest(
        `/api/mathlete/competition/${COMPETITION_ID}/answer`,
        {
          attemptId: "attempt-1",
          competitionProblemId: "cp-1",
          problemType: "numeric",
          rawValue: "42",
          clientUpdatedAt: "2026-04-22T12:00:00.000Z",
        },
        false,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden");
    expect(saveArenaAnswer).not.toHaveBeenCalled();
  });

  test("answer route returns stale-write conflict metadata", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(saveArenaAnswer).mockResolvedValue({
      machine_code: "answer_write_conflict",
      last_saved_at: "2026-04-22T12:03:00.000Z",
    } as never);

    const response = await answerRoute(
      makeMutationRequest(`/api/mathlete/competition/${COMPETITION_ID}/answer`, {
        attemptId: "attempt-1",
        competitionProblemId: "cp-1",
        problemType: "numeric",
        rawValue: "42",
        clientUpdatedAt: "2026-04-22T12:02:59.000Z",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.machineCode).toBe("answer_write_conflict");
    expect(body.data.lastSavedAt).toBe("2026-04-22T12:03:00.000Z");
  });

  test("start route requires signed-in mathlete actor", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient({ userId: null }) as never);

    const response = await startRoute(
      makeMutationRequest(`/api/mathlete/competition/${COMPETITION_ID}/start`, {
        registrationId: "registration-1",
      }),
      {
        params: Promise.resolve({ competitionId: COMPETITION_ID }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("unauthorized");
    expect(startCompetitionAttempt).not.toHaveBeenCalled();
  });

  test("close route returns trusted closed interval count", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(closeActiveAttemptInterval).mockResolvedValue(1 as never);

    const response = await closeRoute(
      makeMutationRequest(`/api/mathlete/competition/${COMPETITION_ID}/close`, {
        attemptId: "attempt-1",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.closedCount).toBe(1);
  });

  test("start route returns refreshed page data after success", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(startCompetitionAttempt).mockResolvedValue({
      machine_code: "ok",
    } as never);
    vi.mocked(loadArenaPageData).mockResolvedValue({
      mode: "arena_runtime",
      competition: {
        id: COMPETITION_ID,
        name: "Arena",
        description: "",
        instructions: "",
        type: "scheduled",
        format: "individual",
        status: "live",
        registrationStart: null,
        registrationEnd: null,
        startTime: null,
        endTime: null,
        durationMinutes: 60,
        attemptsAllowed: 1,
        participantsPerTeam: null,
      },
      registration: null,
      activeAttempt: null,
      latestAttempt: null,
      problems: [],
      eligibleTeams: [],
      attemptsRemaining: 0,
      canRegister: false,
      canResume: false,
      nowIso: "2026-04-22T12:00:00.000Z",
    } as never);

    const response = await startRoute(
      makeMutationRequest(`/api/mathlete/competition/${COMPETITION_ID}/start`, {
        registrationId: "registration-1",
      }),
      {
        params: Promise.resolve({ competitionId: COMPETITION_ID }),
      },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.machineCode).toBe("ok");
    expect(loadArenaPageData).toHaveBeenCalledWith(COMPETITION_ID, MATHLETE_ID);
  });
});
