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

  test("falls back to direct profile update when RPC is unavailable", async () => {
    const update = vi.fn().mockResolvedValue({ error: null });
    const eqRole = vi.fn().mockImplementation(() => ({
      eq: update,
    }));
    const eqId = vi.fn().mockImplementation(() => ({
      eq: eqRole,
    }));
    const updateProfile = vi.fn().mockImplementation(() => ({
      eq: eqId,
    }));
    const from = vi.fn().mockImplementation(() => ({
      update: updateProfile,
    }));
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "Could not find the function public.update_mathlete_profile_settings(...) in the schema cache",
      },
    });

    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      rpc,
      from,
    };

    vi.mocked(createClient).mockResolvedValue(client as never);

    await saveMathleteSettings({
      school: "Mathwiz Academy",
      gradeLevel: "10",
    });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(updateProfile).toHaveBeenCalledWith({
      school: "Mathwiz Academy",
      grade_level: "10",
    });
  });
});
