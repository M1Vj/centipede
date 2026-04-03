import { describe, expect, test, vi, beforeEach } from "vitest";
import { GET } from "@/app/auth/confirm/route";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("auth/confirm GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects to admin for admin users on root next path", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-id" } } }),
      },
      rpc: vi.fn().mockResolvedValue({ data: 2, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: "admin", full_name: "Admin", school: "Math School", grade_level: "12" },
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new Request("http://localhost/auth/confirm?code=valid-code") as unknown as NextRequest;
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/admin");
  });

  test("redirects to organizer for organizer users on root next path", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "org-id" } } }),
      },
      rpc: vi.fn().mockResolvedValue({ data: 2, error: null }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { role: "organizer", full_name: "Org", school: "Math School", grade_level: "12" },
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new Request("http://localhost/auth/confirm?code=valid-code") as unknown as NextRequest;
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/organizer");
  });

  test("respects the 'next' parameter if provided", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }),
      },
      rpc: vi.fn().mockResolvedValue({ data: 2, error: null }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new Request("http://localhost/auth/confirm?code=valid-code&next=/profile") as unknown as NextRequest;
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/profile");
  });

  test("redirects to error page on failed code exchange", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "Invalid code" } }),
      },
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as never);

    const request = new Request("http://localhost/auth/confirm?code=invalid-code") as unknown as NextRequest;
    const response = await GET(request);

    expect(response.headers.get("location")).toBe("http://localhost/auth/error?error=Invalid%20code");
  });
});
