import { describe, expect, test, vi } from "vitest";
import { GET as signOutGet } from "@/app/auth/sign-out/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("sign out route", () => {
  test("clears the session cookie and redirects to the requested path", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: {} } } }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const request = new NextRequest("http://localhost/auth/sign-out?next=/auth/login");
    const response = await signOutGet(request);

    expect(client.auth.signOut).toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/auth/login");
    expect(response.headers.get("set-cookie")).toContain("centipede-session-version=;");
  });
});
