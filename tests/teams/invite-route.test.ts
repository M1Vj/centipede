import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/mathlete/teams/[teamId]/invites/route";
import { requireMathleteActor } from "@/app/api/mathlete/teams/_shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchTeamNotification } from "@/lib/notifications/dispatch";
import {
  fetchActiveMembership,
  fetchTeamById,
  getTeamRosterLock,
  isTeamLeader,
} from "@/lib/teams/guards";
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
  fetchTeamById: vi.fn(),
  getTeamRosterLock: vi.fn(),
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

function chain(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    insert: vi.fn(),
    single: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  query.single.mockResolvedValue(result);
  return query;
}

describe("team invite route notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMathleteActor).mockResolvedValue({
      actor: { userId: INVITER_ID },
    } as never);
    vi.mocked(fetchTeamById).mockResolvedValue({
      id: TEAM_ID,
      name: "Euler Squad",
      is_archived: false,
    } as never);
    vi.mocked(fetchActiveMembership).mockResolvedValue({ id: "membership-1" } as never);
    vi.mocked(isTeamLeader).mockResolvedValue(true);
    vi.mocked(getTeamRosterLock).mockResolvedValue({ locked: false, competitionId: null });
    vi.mocked(reserveTeamAction).mockResolvedValue({
      entryId: "team-action-1",
      resourceId: null,
    } as never);
    vi.mocked(attachTeamActionResource).mockResolvedValue(undefined as never);
  });

  test("sends invitee a visible notification linked to pending invites", async () => {
    const profilesQuery = chain({
      data: {
        id: INVITEE_ID,
        full_name: "Dana Kim",
        role: "mathlete",
        is_active: true,
      },
      error: null,
    });
    const membershipQuery = chain({ data: null, error: null });
    const pendingInviteQuery = chain({ data: null, error: null });
    const insertInviteQuery = chain({
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
    let invitationCalls = 0;

    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return profilesQuery;
        }

        if (table === "team_memberships") {
          return membershipQuery;
        }

        if (table === "team_invitations") {
          invitationCalls += 1;
          return invitationCalls === 1 ? pendingInviteQuery : insertInviteQuery;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new Request(`http://localhost:3000/api/mathlete/teams/${TEAM_ID}/invites`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "x-forwarded-host": "localhost:3000",
        },
        body: JSON.stringify({
          inviteeId: INVITEE_ID,
          requestIdempotencyToken: "invite-token-1",
        }),
      }),
      { params: Promise.resolve({ teamId: TEAM_ID }) },
    );

    expect(response.status).toBe(201);
    expect(dispatchTeamNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "team_invite_sent",
        eventIdentityKey: `team_invite_sent:${INVITE_ID}`,
        recipientId: INVITEE_ID,
        linkPath: "/mathlete/teams/invites",
        title: "Team invite received",
        body: "You were invited to join Euler Squad.",
      }),
    );
  });
});
