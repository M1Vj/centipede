import { beforeEach, describe, expect, test, vi } from "vitest";
import { GET as signOutGet, POST as signOutPost } from "@/app/auth/sign-out/route";
import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("sign out route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("POST clears the session cookie and redirects to the requested path", async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: {} } } }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(client as never);

    const request = new NextRequest("http://localhost/auth/sign-out?next=/auth/login");
    const response = await signOutPost(request);

    expect(client.auth.signOut).toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/auth/login");
    expect(response.headers.get("set-cookie")).toContain("centipede-session-version=;");
  });

  test("GET is rejected with method not allowed", async () => {
    const response = await signOutGet();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(vi.mocked(createClient)).not.toHaveBeenCalled();
  });
});
