import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  approveOrganizerApplication,
  anonymizeUserAccount,
  purgeUser,
  rotateSessionVersion,
  updateMathleteProfileSettings,
} from "@/lib/supabase/admin";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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

function createAdminClientMock() {
  const tables = new Map<string, Record<string, unknown>>();

  const adminClient = {
    from: vi.fn((table: string) => {
      if (!tables.has(table)) {
        tables.set(table, {});
      }

      return tables.get(table);
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      admin: {
        deleteUser: vi.fn(),
        updateUserById: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };

  tables.set("organizer_applications", {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
  tables.set("profiles", {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  tables.set("admin_audit_logs", {
    insert: vi.fn().mockResolvedValue({ error: null }),
  });

  vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

  return adminClient;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("approveOrganizerApplication", () => {
  test("updates organizer application decisions without mutating profiles", async () => {
    const adminClient = createAdminClientMock();

    await approveOrganizerApplication("app-123", "profile-123", "actor-1");

    const tableNames = adminClient.from.mock.calls.map(([table]) => table);
    expect(tableNames).toContain("organizer_applications");
    expect(tableNames).not.toContain("profiles");
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });
});

describe("trusted auth helpers", () => {
  test("rotateSessionVersion calls the trusted rpc", async () => {
    const adminClient = createAdminClientMock();

    await rotateSessionVersion("profile-123");

    expect(adminClient.rpc).toHaveBeenCalledWith("rotate_session_version", {
      profile_id: "profile-123",
    });
  });

  test("updateMathleteProfileSettings only sends school and grade level", async () => {
    const adminClient = createAdminClientMock();

    await updateMathleteProfileSettings("profile-123", "Mathwiz Academy", "10");

    expect(adminClient.rpc).toHaveBeenCalledWith("update_mathlete_profile_settings", {
      profile_id: "profile-123",
      next_school: "Mathwiz Academy",
      next_grade_level: "10",
    });
  });

  test("anonymizeUserAccount passes the required reason and idempotency token", async () => {
    const adminClient = createAdminClientMock();
    adminClient.rpc.mockResolvedValue({
      data: { email: "deleted+abc123@anon.invalid" },
      error: null,
    });

    await anonymizeUserAccount(
      "profile-123",
      "Administrative non-spam account removal",
      "purge-user:profile-123",
      "actor-1",
    );

    expect(adminClient.rpc).toHaveBeenCalledWith("anonymize_user_account", {
      target_profile_id: "profile-123",
      reason: "Administrative non-spam account removal",
      request_idempotency_token: "purge-user:profile-123",
    });
    expect(adminClient.auth.admin.updateUserById).toHaveBeenCalledWith(
      "profile-123",
      expect.objectContaining({
        email: "deleted+abc123@anon.invalid",
        email_confirm: true,
      }),
    );
  });

  test("purgeUser preserves compatibility by delegating to anonymization", async () => {
    const adminClient = createAdminClientMock();

    await purgeUser("profile-123", "actor-1");

    expect(adminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(adminClient.rpc).toHaveBeenCalledWith("anonymize_user_account", {
      target_profile_id: "profile-123",
      reason: "Administrative non-spam account removal",
      request_idempotency_token: "purge-user:profile-123",
    });
  });
});
