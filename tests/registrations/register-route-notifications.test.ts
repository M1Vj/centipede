import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/mathlete/competition/register/route";
import { requireMathleteActor } from "@/app/api/mathlete/competition/_shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";

vi.mock("@/app/api/mathlete/competition/_shared", async () => {
  const actual = await vi.importActual<typeof import("@/app/api/mathlete/competition/_shared")>(
    "@/app/api/mathlete/competition/_shared",
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
  dispatchCompetitionNotification: vi.fn().mockResolvedValue({ ok: true, skipped: false }),
}));

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_ID = "22222222-2222-4222-8222-222222222222";
const COMPETITION_ID = "33333333-3333-4333-8333-333333333333";
const REGISTRATION_ID = "44444444-4444-4444-8444-444444444444";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";

function queryResult(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    returns: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.returns.mockResolvedValue(result);
  return query;
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/mathlete/competition/register", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
    },
    body: JSON.stringify(body),
  });
}

describe("competition registration notification recipients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMathleteActor).mockResolvedValue({
      actor: { userId: ACTOR_ID },
      supabase: {
        rpc: vi.fn().mockResolvedValue({
          data: [{
            machine_code: "ok",
            registration_id: REGISTRATION_ID,
            status: "registered",
            status_reason: null,
          }],
          error: null,
        }),
      },
    } as never);
  });

  test("fans team registration confirmation out to active team members", async () => {
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "team_memberships") {
          return queryResult({
            data: [
              { profile_id: ACTOR_ID },
              { profile_id: MEMBER_ID },
            ],
            error: null,
          });
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(request({
      competitionId: COMPETITION_ID,
      teamId: TEAM_ID,
      requestIdempotencyToken: "register-token-1",
    }));

    expect(response.status).toBe(200);
    expect(dispatchCompetitionNotification).toHaveBeenCalledTimes(2);
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(expect.objectContaining({
      event: "competition_registration_confirmed",
      eventIdentityKey: `competition_registration_confirmed:${COMPETITION_ID}:${REGISTRATION_ID}`,
      recipientId: ACTOR_ID,
      competitionId: COMPETITION_ID,
      registrationId: REGISTRATION_ID,
      metadata: { teamId: TEAM_ID },
    }));
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: MEMBER_ID,
    }));
  });

  test("keeps individual registration notification scoped to the actor", async () => {
    vi.mocked(createAdminClient).mockReturnValue(null as never);

    const response = await POST(request({
      competitionId: COMPETITION_ID,
      teamId: null,
      requestIdempotencyToken: "register-token-2",
    }));

    expect(response.status).toBe(200);
    expect(dispatchCompetitionNotification).toHaveBeenCalledTimes(1);
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(expect.objectContaining({
      recipientId: ACTOR_ID,
      metadata: { teamId: null },
    }));
  });
});
