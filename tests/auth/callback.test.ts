import { describe, expect, test, vi, beforeEach, type Mock } from "vitest";
import { GET } from "@/app/auth/confirm/route";
import { createClient } from "@/lib/supabase/server";
import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

describe("auth/confirm GET", () => {
  const mockCreateClient = createClient as unknown as Mock;
  const mockRedirect = redirect as unknown as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects to admin for admin users on root next path", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "admin-id" } } }),
      },
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
    mockCreateClient.mockResolvedValue(mockSupabase);

    const request = new Request("http://localhost/auth/confirm?code=valid-code") as unknown as NextRequest;
    await GET(request);

    expect(mockRedirect).toHaveBeenCalledWith("/admin");
  });

  test("redirects to organizer for organizer users on root next path", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "org-id" } } }),
      },
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
    mockCreateClient.mockResolvedValue(mockSupabase);

    const request = new Request("http://localhost/auth/confirm?code=valid-code") as unknown as NextRequest;
    await GET(request);

    expect(mockRedirect).toHaveBeenCalledWith("/organizer");
  });

  test("respects the 'next' parameter if provided", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }),
      },
    };
    mockCreateClient.mockResolvedValue(mockSupabase);

    const request = new Request("http://localhost/auth/confirm?code=valid-code&next=/profile") as unknown as NextRequest;
    await GET(request);

    expect(mockRedirect).toHaveBeenCalledWith("/profile");
  });

  test("redirects to error page on failed code exchange", async () => {
    const mockSupabase = {
      auth: {
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: "Invalid code" } }),
      },
    };
    mockCreateClient.mockResolvedValue(mockSupabase);

    const request = new Request("http://localhost/auth/confirm?code=invalid-code") as unknown as NextRequest;
    await GET(request);

    expect(mockRedirect).toHaveBeenCalledWith("/auth/error?error=Invalid%20code");
  });
});
