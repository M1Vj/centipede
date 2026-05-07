import { beforeEach, describe, expect, test, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";
import { dispatchCompetitionStartedNotifications } from "@/lib/notifications/competition-start";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchCompetitionNotification: vi.fn().mockResolvedValue({
    ok: true,
    skipped: false,
  }),
}));

function makeQuery(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    returns: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.returns.mockResolvedValue(result);
  return query;
}

describe("competition start notification fanout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("notifies organizer and registered mathletes with stable idempotency keys", async () => {
    const registrationQuery = makeQuery({
      data: [
        {
          id: "registration-1",
          profile_id: "mathlete-1",
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
    const membershipQuery = makeQuery({
      data: [
        {
          team_id: "team-1",
          profile_id: "team-leader-1",
        },
        {
          team_id: "team-1",
          profile_id: "team-member-2",
        },
      ],
      error: null,
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competition_registrations") {
          return registrationQuery;
        }

        if (table === "team_memberships") {
          return membershipQuery;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const result = await dispatchCompetitionStartedNotifications({
      actorId: "organizer-1",
      competitionId: "22222222-2222-2222-2222-222222222222",
      organizerId: "organizer-1",
      requestIdempotencyToken: "idem-token",
    });

    expect(result).toEqual({
      attempted: 4,
      sent: 4,
      skipped: 0,
      failed: 0,
    });
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "competition_started",
        eventIdentityKey: "competition_started:22222222-2222-2222-2222-222222222222:organizer",
        linkPath: "/organizer/competition/22222222-2222-2222-2222-222222222222",
        recipientId: "organizer-1",
      }),
    );
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "competition_started",
        eventIdentityKey:
          "competition_started:22222222-2222-2222-2222-222222222222:registration:registration-1",
        linkPath: "/mathlete/competition/22222222-2222-2222-2222-222222222222",
        recipientId: "mathlete-1",
      }),
    );
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "competition_started",
        eventIdentityKey:
          "competition_started:22222222-2222-2222-2222-222222222222:registration:registration-2",
        recipientId: "team-leader-1",
      }),
    );
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "competition_started",
        eventIdentityKey:
          "competition_started:22222222-2222-2222-2222-222222222222:registration:registration-2",
        recipientId: "team-member-2",
      }),
    );
  });

  test("fails without partial delivery when team membership recipients cannot be loaded", async () => {
    const registrationQuery = makeQuery({
      data: [
        {
          id: "registration-1",
          profile_id: null,
          team_id: "team-1",
        },
      ],
      error: null,
    });
    const membershipQuery = makeQuery({
      data: null,
      error: new Error("membership lookup failed"),
    });

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competition_registrations") {
          return registrationQuery;
        }

        if (table === "team_memberships") {
          return membershipQuery;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const result = await dispatchCompetitionStartedNotifications({
      actorId: "organizer-1",
      competitionId: "22222222-2222-2222-2222-222222222222",
      organizerId: "organizer-1",
      requestIdempotencyToken: "idem-token",
    });

    expect(result).toEqual({
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 1,
    });
    expect(dispatchCompetitionNotification).not.toHaveBeenCalled();
  });
});
