import { beforeEach, describe, expect, test, vi } from "vitest";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  hasEnvVars: true,
  getSupabaseEnv: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublicKey: "public-key",
    supabaseServiceKey: "service-key",
  }),
}));

describe("updateSession proxy bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("bypasses auth proxy handling for /auth/session", async () => {
    const request = new NextRequest("http://localhost/auth/session", {
      method: "POST",
    });

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  test("keeps existing bypass behavior for /auth/sign-out", async () => {
    const request = new NextRequest("http://localhost/auth/sign-out", {
      method: "GET",
    });

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  test("redirects signed-in mathletes away from sign-up", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "mathlete-1",
        email: "mathlete@example.com",
        full_name: "Mathlete User",
        school: "Math School",
        grade_level: "12",
        organization: null,
        approved_at: null,
        role: "mathlete",
        is_active: true,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });

    vi.mocked(createServerClient).mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "mathlete-1" } },
          error: null,
        }),
      },
      from,
    } as never);

    const request = new NextRequest("http://localhost/auth/sign-up");
    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/mathlete");
    expect(from).toHaveBeenCalledWith("profiles");
  });
});
