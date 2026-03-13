import { describe, expect, test, vi } from "vitest";
import { saveProfile } from "@/lib/auth/profile-write";

describe("saveProfile", () => {
  test("upserts the profile row so first-time users can complete onboarding", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn(() => ({
        upsert,
      })),
    };

    await saveProfile({
      client,
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
        upsert: vi.fn().mockResolvedValue({ error }),
      })),
    };

    await expect(
      saveProfile({
        client,
        userId: "user-123",
        email: "mathlete@gmail.com",
        fullName: "VJ Mabansag",
        school: "Mathwiz Academy",
        gradeLevel: "10",
      }),
    ).rejects.toThrow("row level security blocked update");
  });
});
