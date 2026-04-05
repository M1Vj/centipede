import { beforeEach, describe, expect, test, vi } from "vitest";
import { saveProfile } from "@/lib/auth/profile-write";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("saveProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("upserts the profile row so first-time users can complete onboarding", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "user-123", role: "mathlete" }, error: null }),
    });
    const client = {
      from: vi.fn(() => ({
        upsert,
      })),
    };

    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);

    const mockAuthUser = { id: "user-123", email: "Mathlete@Gmail.com" };
    const authClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockAuthUser } }) }
    };
    vi.mocked(createClient).mockResolvedValue(authClient as never);

    await saveProfile({
      fullName: "  VJ Mabansag ",
      school: " Mathwiz Academy ",
      gradeLevel: " 10 ",
    });

    expect(client.from).toHaveBeenCalledWith("profiles");
    expect(upsert).toHaveBeenCalledWith(
      {
        id: "user-123",
        email: "mathlete@gmail.com",
        full_name: "VJ Mabansag",
        school: "Mathwiz Academy",
        grade_level: "10",
        updated_at: expect.any(String),
      },
      {
        onConflict: "id",
      },
    );
  });

  test("rethrows Supabase write errors", async () => {
    const error = new Error("row level security blocked update");
    const client = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error }),
      })),
    };

    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);

    const mockAuthUser = { id: "user-123", email: "mathlete@gmail.com" };
    const authClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockAuthUser } }) }
    };
    vi.mocked(createClient).mockResolvedValue(authClient as never);

    await expect(
      saveProfile({
        fullName: "VJ Mabansag",
        school: "Mathwiz Academy",
        gradeLevel: "10",
      }),
    ).rejects.toThrow("row level security blocked update");
  });

  test("SECURITY: always persists the server-auth email", async () => {
    const upsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "server-validated-123", role: "mathlete" }, error: null }),
    });
    
    // Admin client mock
    const client = {
      from: vi.fn(() => ({ upsert })),
    };
    vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>);

    const mockAuthUser = { id: "server-validated-123", email: "server-auth@email.com" };
    const authClient = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockAuthUser } }) }
    };
    vi.mocked(createClient).mockResolvedValue(authClient as never);

    await saveProfile({
      fullName: "Hacker Man",
      school: "Hacker School",
      gradeLevel: "10",
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "server-validated-123",
        email: "server-auth@email.com",
      }),
      expect.any(Object),
    );
  });
});
