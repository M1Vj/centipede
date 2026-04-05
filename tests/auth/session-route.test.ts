import { describe, expect, test, vi } from "vitest";
import { POST as rotateSessionPost } from "@/app/auth/session/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

function makeRequest(body?: unknown) {
  return new Request("http://localhost/auth/session", {
    method: "POST",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("auth session rotation route", () => {
  test("rotates the session version and persists the cookie", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 5, error: null });
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      rpc,
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await rotateSessionPost(makeRequest());

    expect(rpc).toHaveBeenCalledWith("rotate_session_version", {
      profile_id: "user-1",
    });
    expect(response.headers.get("set-cookie")).toContain("centipede-session-version=5");
  });

  test("hydrates the server session from access and refresh tokens", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    const setSession = vi.fn().mockResolvedValue({
      data: { user: { id: "token-user-1" } },
      error: null,
    });

    const client = {
      auth: {
        getUser,
        setSession,
      },
      rpc,
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await rotateSessionPost(makeRequest({
      accessToken: "access-token",
      refreshToken: "refresh-token",
    }));

    expect(setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(rpc).toHaveBeenCalledWith("rotate_session_version", {
      profile_id: "token-user-1",
    });
    expect(response.status).toBe(200);
  });

  test("returns unauthorized when there is no authenticated user", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        setSession: vi.fn(),
      },
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await rotateSessionPost(makeRequest());

    expect(response.status).toBe(401);
  });

  test("still succeeds when rotation RPC is unavailable", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
        setSession: vi.fn(),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "42883", message: "function rotate_session_version does not exist" },
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await rotateSessionPost(makeRequest());

    expect(response.status).toBe(200);
  });

  test("returns server error when rotation fails for non-schema reasons", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
        setSession: vi.fn(),
      },
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST301", message: "backend unavailable" },
      }),
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await rotateSessionPost(makeRequest());

    expect(response.status).toBe(500);
  });
});
