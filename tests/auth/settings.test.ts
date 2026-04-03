import { describe, expect, test, vi } from "vitest";
import { saveMathleteSettings } from "@/lib/auth/settings";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("saveMathleteSettings", () => {
  test("calls the trusted mathlete settings helper with trimmed school and grade level only", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      rpc,
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    await saveMathleteSettings({
      school: "  Mathwiz Academy ",
      gradeLevel: " 10 ",
    });

    expect(rpc).toHaveBeenCalledWith("update_mathlete_profile_settings", {
      profile_id: "user-1",
      next_school: "Mathwiz Academy",
      next_grade_level: "10",
    });
  });

  test("rejects unauthenticated requests", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(
      saveMathleteSettings({
        school: "Mathwiz Academy",
        gradeLevel: "10",
      }),
    ).rejects.toThrow("Unauthorized");
  });
});
