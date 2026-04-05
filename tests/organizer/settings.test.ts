import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient as createOrganizerAdminClient } from "@supabase/supabase-js";
import {
  getOrganizerSettingsSnapshot,
  saveOrganizerSettings,
} from "@/lib/organizer/settings";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({
    supabaseUrl: "https://example.supabase.co",
    supabasePublicKey: "public-key",
    supabaseServiceKey: "service-key",
  }),
}));

describe("organizer settings persistence fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns deterministic degraded result when organizer settings columns are unavailable", async () => {
    const userClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      },
      from: vi.fn(),
    };

    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: "column organizer_applications.contact_phone does not exist",
      },
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const order = vi.fn().mockImplementation(() => ({ limit }));
    const eq = vi.fn().mockImplementation(() => ({ order }));
    const select = vi.fn().mockImplementation(() => ({ eq }));
    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    const adminClient = {
      from,
    };

    vi.mocked(createClient).mockResolvedValue(userClient as never);
    vi.mocked(createOrganizerAdminClient).mockReturnValue(adminClient as never);

    const result = await saveOrganizerSettings({
      contactPhone: "+1 555 0101",
      organizationType: "Academy",
    });

    expect(result).toEqual({
      persistenceState: "degraded",
      warning:
        "Organizer settings are temporarily unavailable in this environment. Contact phone and organization type were not persisted.",
    });
    expect(userClient.from).not.toHaveBeenCalled();
  });

  test("returns deterministic degraded snapshot instead of mapping profile organization", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: "column organizer_applications.organization_type does not exist",
      },
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const order = vi.fn().mockImplementation(() => ({ limit }));
    const eq = vi.fn().mockImplementation(() => ({ order }));
    const select = vi.fn().mockImplementation(() => ({ eq }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    vi.mocked(createOrganizerAdminClient).mockReturnValue({ from } as never);

    const snapshot = await getOrganizerSettingsSnapshot("profile-1");

    expect(snapshot).toEqual({
      contactPhone: "",
      organizationType: "",
      persistenceState: "degraded",
      warning:
        "Organizer settings are temporarily unavailable in this environment. Contact phone and organization type were not persisted.",
    });
    expect(from).toHaveBeenCalledWith("organizer_applications");
    expect(from).not.toHaveBeenCalledWith("profiles");
  });

  test("returns available snapshot values when organizer settings columns exist", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        contact_phone: "+1 555 9999",
        organization_type: "School",
      },
      error: null,
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const order = vi.fn().mockImplementation(() => ({ limit }));
    const eq = vi.fn().mockImplementation(() => ({ order }));
    const select = vi.fn().mockImplementation(() => ({ eq }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    vi.mocked(createOrganizerAdminClient).mockReturnValue({ from } as never);

    const snapshot = await getOrganizerSettingsSnapshot("profile-2");

    expect(snapshot).toEqual({
      contactPhone: "+1 555 9999",
      organizationType: "School",
      persistenceState: "available",
      warning: null,
    });
  });
});
