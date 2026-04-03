import { describe, expect, test, vi } from "vitest";
import { POST as rotateSessionPost } from "@/app/auth/session/route";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

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

    const response = await rotateSessionPost();

    expect(rpc).toHaveBeenCalledWith("rotate_session_version", {
      profile_id: "user-1",
    });
    expect(response.headers.get("set-cookie")).toContain("centipede-session-version=5");
  });

  test("returns unauthorized when there is no authenticated user", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const response = await rotateSessionPost();

    expect(response.status).toBe(401);
  });
});
