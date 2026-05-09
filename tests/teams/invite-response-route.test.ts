import { beforeEach, describe, expect, test, vi } from "vitest";
import { PATCH } from "@/app/api/mathlete/teams/invites/[inviteId]/route";
import { requireMathleteActor } from "@/app/api/mathlete/teams/_shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";
import { getTeamRosterLock, hasTeamRegistrationConflict } from "@/lib/teams/guards";
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
  fetchActiveMembership: vi.fn(),
  getTeamRosterLock: vi.fn(),
  hasTeamRegistrationConflict: vi.fn(),
  isTeamLeader: vi.fn(),
}));

vi.mock("@/lib/teams/idempotency", () => ({
  attachTeamActionResource: vi.fn(),
  reserveTeamAction: vi.fn(),
}));

const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const INVITER_ID = "22222222-2222-4222-8222-222222222222";
const INVITEE_ID = "33333333-3333-4333-8333-333333333333";
const INVITE_ID = "44444444-4444-4444-8444-444444444444";
const CURRENT_LEADER_ID = "55555555-5555-4555-8555-555555555555";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
    returns: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.maybeSingle.mockResolvedValue(result);
  builder.single.mockResolvedValue(result);
  builder.returns.mockResolvedValue(result);
  return builder;
}

describe("team invite response notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMathleteActor).mockResolvedValue({
      actor: { userId: INVITEE_ID },
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

  test("notifies the current active leader when an invited mathlete accepts", async () => {
    const inviteRead = query({
      data: {
        id: INVITE_ID,
        team_id: TEAM_ID,
        inviter_id: INVITER_ID,
        invitee_id: INVITEE_ID,
        status: "pending",
        created_at: "2026-05-07T00:00:00.000Z",
        responded_at: null,
      },
      error: null,
    });
    const membershipInsert = query({ data: { id: "membership-1" }, error: null });
    const inviteUpdate = query({
      data: {
        id: INVITE_ID,
        team_id: TEAM_ID,
        inviter_id: INVITER_ID,
        invitee_id: INVITEE_ID,
        status: "accepted",
        created_at: "2026-05-07T00:00:00.000Z",
        responded_at: "2026-05-07T00:01:00.000Z",
      },
      error: null,
    });
    const leaderLookup = query({
      data: [{ profile_id: CURRENT_LEADER_ID }],
      error: null,
    });
    let invitationCalls = 0;
    let membershipCalls = 0;

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_invitations") {
          invitationCalls += 1;
          return invitationCalls === 1 ? inviteRead : inviteUpdate;
        }

        if (table === "team_memberships") {
          membershipCalls += 1;
          return membershipCalls === 1 ? membershipInsert : leaderLookup;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new Request(`http://localhost:3000/api/mathlete/teams/invites/${INVITE_ID}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-host": "localhost:3000",
        },
        body: JSON.stringify({
          action: "accept",
          requestIdempotencyToken: "accept-token-1",
        }),
      }),
      { params: Promise.resolve({ inviteId: INVITE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(dispatchTeamNotification).toHaveBeenCalledWith(expect.objectContaining({
      event: "team_invite_accepted",
      eventIdentityKey: `team_invite_accepted:${INVITE_ID}`,
      recipientId: CURRENT_LEADER_ID,
      actorId: INVITEE_ID,
      teamId: TEAM_ID,
      inviteId: INVITE_ID,
      metadata: { inviteeId: INVITEE_ID },
    }));
    expect(dispatchTeamNotification).not.toHaveBeenCalledWith(expect.objectContaining({
      recipientId: INVITER_ID,
    }));
  });
});
