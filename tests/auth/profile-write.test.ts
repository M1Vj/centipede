import { describe, expect, test, vi } from "vitest";
import { saveProfile } from "@/lib/auth/profile-write";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

describe("saveProfile", () => {
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

    await saveProfile({
      userId: "user-123",
      email: "mathlete@gmail.com",
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

    await expect(
      saveProfile({
        userId: "user-123",
        email: "mathlete@gmail.com",
        fullName: "VJ Mabansag",
        school: "Mathwiz Academy",
        gradeLevel: "10",
      }),
    ).rejects.toThrow("row level security blocked update");
  });
});
