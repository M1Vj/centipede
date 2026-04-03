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
});
