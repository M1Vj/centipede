import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/mathlete/teams/join/route";
import { requireMathleteActor } from "@/app/api/mathlete/teams/_shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";
import { fetchTeamByCode, getTeamRosterLock, hasTeamRegistrationConflict } from "@/lib/teams/guards";
import { attachTeamActionResource, reserveTeamAction } from "@/lib/teams/idempotency";

vi.mock("@/app/api/mathlete/teams/_shared", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/mathlete/teams/_shared")>(
    "@/app/api/mathlete/teams/_shared",
  );

  return {
    ...actual,
    requireMathleteActor: vi.fn(),
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchTeamNotification: vi.fn().mockResolvedValue({ ok: true, skipped: false }),
}));

vi.mock("@/lib/teams/guards", () => ({
  fetchTeamByCode: vi.fn(),
  getTeamRosterLock: vi.fn(),
  hasTeamRegistrationConflict: vi.fn(),
}));

vi.mock("@/lib/teams/idempotency", () => ({
  attachTeamActionResource: vi.fn(),
  reserveTeamAction: vi.fn(),
}));

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const JOINER_ID = "22222222-2222-4222-8222-222222222222";
const LEADER_ONE_ID = "33333333-3333-4333-8333-333333333333";
const LEADER_TWO_ID = "44444444-4444-4444-8444-444444444444";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    returns: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
  builder.returns.mockResolvedValue(result);
  return builder;
}

describe("team code join notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMathleteActor).mockResolvedValue({
      actor: { userId: JOINER_ID },
    } as never);
    vi.mocked(fetchTeamByCode).mockResolvedValue({
      id: TEAM_ID,
      name: "Euler Squad",
      team_code: "ABC1234567",
      created_by: LEADER_ONE_ID,
      is_archived: false,
    } as never);
    vi.mocked(getTeamRosterLock).mockResolvedValue({ locked: false, competitionId: null });
    vi.mocked(hasTeamRegistrationConflict).mockResolvedValue({
      conflict: false,
      competitionId: null,
    });
    vi.mocked(reserveTeamAction).mockResolvedValue({
      entryId: "team-action-1",
      resourceId: null,
    } as never);
    vi.mocked(attachTeamActionResource).mockResolvedValue(undefined as never);
  });

  test("notifies every active leader when a mathlete joins by team code", async () => {
    const existingMembership = query({ data: null, error: null });
    const membershipInsert = query({
      data: {
        id: "membership-1",
        team_id: TEAM_ID,
        profile_id: JOINER_ID,
        role: "member",
        joined_at: "2026-05-07T00:00:00.000Z",
        left_at: null,
        is_active: true,
      },
      error: null,
    });
    const leaders = query({
      data: [
        { profile_id: LEADER_ONE_ID },
        { profile_id: LEADER_TWO_ID },
      ],
      error: null,
    });
    let membershipCalls = 0;

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_memberships") {
          membershipCalls += 1;
          if (membershipCalls === 1) {
            return existingMembership;
          }
          return membershipCalls === 2 ? membershipInsert : leaders;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request("http://localhost:3000/api/mathlete/teams/join", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-host": "localhost:3000",
        },
        body: JSON.stringify({
          teamCode: "ABC1234567",
          requestIdempotencyToken: "join-token-1",
        }),
      }) as never,
    );

    expect(response.status).toBe(200);
    expect(dispatchTeamNotification).toHaveBeenCalledTimes(2);
    expect(dispatchTeamNotification).toHaveBeenCalledWith(expect.objectContaining({
      event: "team_invite_accepted",
      eventIdentityKey: `team_invite_accepted:code:${TEAM_ID}:${JOINER_ID}`,
      recipientId: LEADER_ONE_ID,
      actorId: JOINER_ID,
      teamId: TEAM_ID,
      inviteId: null,
      metadata: { joinMethod: "code" },
    }));
    expect(dispatchTeamNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: LEADER_TWO_ID,
    }));
  });
});
