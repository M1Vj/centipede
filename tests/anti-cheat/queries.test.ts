import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompetitionOffenses } from "@/lib/anti-cheat/queries";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

type ResultRow = {
  data: unknown;
  error: { code?: string | null; message?: string | null; details?: string | null } | null;
};

function makeQuery(result: ResultRow) {
  const query: Record<string, unknown> = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: ResultRow) => void, reject: (reason?: unknown) => void) =>
      Promise.resolve(result).then(resolve, reject),
  };

  return query;
}

describe("getCompetitionOffenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rebuilds offense logs from admin-side lookups and preserves participant names", async () => {
    const competitionQuery = makeQuery({
      data: { id: "competition-1", organizer_id: "organizer-1" },
      error: null,
    });
    const attemptsQuery = makeQuery({
      data: [
        { id: "attempt-1", registration_id: "registration-1" },
        { id: "attempt-2", registration_id: "registration-2" },
      ],
      error: null,
    });
    const logsQuery = makeQuery({
      data: [
        {
          id: "log-2",
          attempt_id: "attempt-2",
          offense_number: 2,
          penalty_applied: "deduction",
          logged_at: "2026-04-22T12:35:00.000Z",
          client_timestamp: "2026-04-22T12:34:59.000Z",
          metadata_json: {
            event_source: "blur",
          },
        },
        {
          id: "log-1",
          attempt_id: "attempt-1",
          offense_number: 1,
          penalty_applied: "warning",
          logged_at: "2026-04-22T12:34:56.000Z",
          client_timestamp: null,
          metadata_json: {
            event_source: "visibilitychange",
          },
        },
      ],
      error: null,
    });
    const registrationsQuery = makeQuery({
      data: [
        {
          id: "registration-1",
          profile_id: "profile-1",
          team_id: null,
        },
        {
          id: "registration-2",
          profile_id: null,
          team_id: "team-1",
        },
      ],
      error: null,
    });
    const profilesQuery = makeQuery({
      data: [{ id: "profile-1", full_name: "Dana Kim" }],
      error: null,
    });
    const teamsQuery = makeQuery({
      data: [{ id: "team-1", name: "Euler Squad" }],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return competitionQuery;
        }

        if (table === "competition_attempts") {
          return attemptsQuery;
        }

        if (table === "tab_switch_logs") {
          return logsQuery;
        }

        if (table === "competition_registrations") {
          return registrationsQuery;
        }

        if (table === "profiles") {
          return profilesQuery;
        }

        if (table === "teams") {
          return teamsQuery;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const logs = await getCompetitionOffenses("competition-1", "organizer-1");

    expect(logs).toHaveLength(2);
    expect(logs[0].id).toBe("log-2");
    expect(logs[0].competition_attempts?.competition_registrations?.teams?.name).toBe("Euler Squad");
    expect(logs[1].competition_attempts?.competition_registrations?.profiles?.full_name).toBe("Dana Kim");
    expect(logs[1].metadata_json).toEqual({ event_source: "visibilitychange" });
  });

  test("returns empty list when caller does not own competition", async () => {
    const competitionQuery = makeQuery({
      data: { id: "competition-1", organizer_id: "organizer-1" },
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return competitionQuery;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    await expect(getCompetitionOffenses("competition-1", "organizer-2")).resolves.toEqual([]);
  });
});
