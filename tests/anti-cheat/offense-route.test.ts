import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/anti-cheat/offense/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

function makeMathleteClient(options?: { userId?: string | null; rpcResult?: string; rpcError?: string }) {
  const userId = options && "userId" in options ? options.userId : "mathlete-1";
  const profileQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: userId
        ? {
            id: userId,
            role: "mathlete",
            is_active: true,
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
    rpc: vi.fn().mockResolvedValue(
      options?.rpcError
        ? { data: null, error: { message: options.rpcError } }
        : { data: options?.rpcResult ?? "warning", error: null },
    ),
  };
}

function makeRequest(body: Record<string, unknown>, withOrigin = true) {
  return new Request("http://localhost:3000/api/anti-cheat/offense", {
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

function makeBeaconLikeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/anti-cheat/offense", {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
}

function makeBeaconRequestWithoutOrigin(body: Record<string, unknown>) {
  return new Request("http://localhost:3000/api/anti-cheat/offense", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      referer: "http://localhost:3000/mathlete/competition/competition-1",
      "sec-fetch-site": "same-origin",
      "content-type": "text/plain;charset=UTF-8",
    },
    body: JSON.stringify(body),
  });
}

describe("anti-cheat offense route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects cross-site offense requests", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);

    const response = await POST(
      makeRequest(
        {
          attemptId: "attempt-1",
          metadata: { event_source: "blur" },
        },
        false,
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.code).toBe("forbidden");
  });

  test("requires signed-in mathlete actor", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient({ userId: null }) as never);

    const response = await POST(
      makeRequest({
        attemptId: "attempt-1",
        metadata: { event_source: "blur" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("unauthorized");
  });

  test("logs sanitized offense metadata through RPC", async () => {
    const client = makeMathleteClient({ rpcResult: "auto_submit" });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const response = await POST(
      makeRequest({
        attemptId: "attempt-1",
        metadata: {
          event_source: "blur".repeat(40),
          visibility_state: "hidden",
          route_path: "/mathlete/competition/competition-1",
          user_agent: "test-agent",
          client_timestamp: "2026-05-02T00:00:00.000Z",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.penaltyApplied).toBe("auto_submit");
    expect(client.rpc).toHaveBeenCalledWith("log_tab_switch_offense", {
      p_attempt_id: "attempt-1",
      p_actor_user_id: "mathlete-1",
      p_metadata_json: expect.objectContaining({
        event_source: expect.stringMatching(/^blur/),
      }),
    });
    expect(client.rpc.mock.calls[0][1].p_metadata_json.event_source).toHaveLength(50);
  });

  test("accepts beacon-style JSON text bodies", async () => {
    const client = makeMathleteClient({ rpcResult: "warning" });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const response = await POST(
      makeBeaconLikeRequest({
        attemptId: "attempt-1",
        metadata: {
          event_source: "visibilitychange",
          visibility_state: "hidden",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalledWith("log_tab_switch_offense", {
      p_attempt_id: "attempt-1",
      p_actor_user_id: "mathlete-1",
      p_metadata_json: expect.objectContaining({
        event_source: "visibilitychange",
        visibility_state: "hidden",
      }),
    });
  });

  test("accepts same-origin beacon requests when Origin is missing", async () => {
    const client = makeMathleteClient({ rpcResult: "warning" });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const response = await POST(
      makeBeaconRequestWithoutOrigin({
        attemptId: "attempt-1",
        metadata: {
          event_source: "pagehide",
          visibility_state: "hidden",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(client.rpc).toHaveBeenCalled();
  });

  test("maps expected inactive attempt races without returning a server error", async () => {
    const client = makeMathleteClient({ rpcError: "attempt_not_active" });
    vi.mocked(createClient).mockResolvedValue(client as never);
    vi.mocked(createAdminClient).mockReturnValue(client as never);

    const response = await POST(
      makeRequest({
        attemptId: "attempt-1",
        metadata: { event_source: "pagehide" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.code).toBe("attempt_not_active");
  });

  test("reports anti-cheat service unavailable when service role client is missing", async () => {
    vi.mocked(createClient).mockResolvedValue(makeMathleteClient() as never);
    vi.mocked(createAdminClient).mockReturnValue(null);

    const response = await POST(
      makeRequest({
        attemptId: "attempt-1",
        metadata: { event_source: "blur" },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.code).toBe("service_unavailable");
  });
});
