import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  lookupOrganizerApplicationStatus,
  prepareOrganizerIdentityForApproval,
  submitOrganizerApplication,
} from "@/lib/organizer/lifecycle";
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

vi.mock("@/lib/organizer/email", () => ({
  sendOrganizerLifecycleEmail: vi.fn().mockResolvedValue({
    providerMessageId: "provider-message-id",
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("organizer lifecycle RPC fallbacks", () => {
  test("submitOrganizerApplication falls back to direct insert when intake RPC is unavailable", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const order = vi.fn().mockImplementation(() => ({ limit }));
    const eqStatus = vi.fn().mockImplementation(() => ({ order }));
    const ilike = vi.fn().mockImplementation(() => ({ eq: eqStatus }));
    const select = vi.fn().mockImplementation(() => ({ ilike }));

    const eqUpdate = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockImplementation(() => ({ eq: eqUpdate }));

    const single = vi.fn().mockResolvedValue({ data: { id: "app-123" }, error: null });
    const selectAfterInsert = vi.fn().mockImplementation(() => ({ single }));
    const insert = vi.fn().mockImplementation(() => ({ select: selectAfterInsert }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
        update,
        insert,
      };
    });

    const rpc = vi.fn().mockImplementation(async (fnName: string) => {
      if (fnName === "insert_organizer_application_intake") {
        return {
          data: null,
          error: {
            code: "42883",
            message: "function public.insert_organizer_application_intake does not exist",
          },
        };
      }

      if (fnName === "claim_organizer_application_communication") {
        return { data: null, error: null };
      }

      return { data: null, error: null };
    });

    const adminClient = {
      rpc,
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    const result = await submitOrganizerApplication({
      applicantFullName: " Organizer Applicant ",
      organizationName: " Mathwiz Academy ",
      contactEmail: "ORGANIZER@EXAMPLE.COM",
      contactPhone: "123-456-7890",
      organizationType: "School",
      statement: "We host training camps.",
      hasAcceptedDataPrivacyAct: true,
      hasAcceptedTerms: true,
      logoFile: null,
      profileId: null,
    });

    expect(result.applicationId).toBe("app-123");
    expect(result.createdNew).toBe(true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        applicant_full_name: "Organizer Applicant",
        organization_name: "Mathwiz Academy",
        contact_email: "organizer@example.com",
        contact_phone: "123-456-7890",
        organization_type: "School",
        status: "pending",
      }),
    );
  });

  test("lookupOrganizerApplicationStatus falls back to direct lookup when status RPC is unavailable", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        status: "rejected",
        rejection_reason:
          "Reach us at admin@example.com or https://example.com call +1234567890 <b>Denied</b>",
        contact_email: "organizer@example.com",
      },
      error: null,
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const gt = vi.fn().mockImplementation(() => ({ limit }));
    const eq = vi.fn().mockImplementation(() => ({ gt }));
    const select = vi.fn().mockImplementation(() => ({ eq }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.lookup_organizer_application_status does not exist",
      },
    });

    const adminClient = {
      rpc,
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    const result = await lookupOrganizerApplicationStatus("a".repeat(64), "127.0.0.11");

    expect(result.machineCode).toBe("ok");
    if (result.machineCode === "ok") {
      expect(result.status).toBe("rejected");
      expect(result.maskedContactEmail).toBe("o********@example.com");
      expect(result.rejectionReason).toContain("[redacted-email]");
      expect(result.rejectionReason).toContain("[redacted-link]");
      expect(result.rejectionReason).toContain("[redacted-phone]");
      expect(result.rejectionReason).not.toContain("admin@example.com");
      expect(result.rejectionReason).not.toContain("https://example.com");
    }
  });

  test("prepareOrganizerIdentityForApproval rejects approval when contact email is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "app-123",
        status: "pending",
        profile_id: null,
        applicant_full_name: "Organizer Applicant",
        organization_name: "Mathwiz Academy",
        contact_email: null,
        rejection_reason: null,
      },
      error: null,
    });
    const eq = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const select = vi.fn().mockImplementation(() => ({ eq }));
    const from = vi.fn().mockImplementation(() => ({ select }));

    const adminClient = {
      rpc: vi.fn(),
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    await expect(
      prepareOrganizerIdentityForApproval("app-123", "profile-123"),
    ).rejects.toThrow("Application contact email is required for approval.");
  });

  test("prepareOrganizerIdentityForApproval provisions an auth user when invite email hits the send rate limit", async () => {
    const applicationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "app-123",
        status: "pending",
        profile_id: null,
        applicant_full_name: "QA Comprehensive Test",
        organization_name: "Comprehensive Testing Org",
        contact_email: "comprehensive-test@example.com",
        rejection_reason: null,
      },
      error: null,
    });
    const applicationEq = vi.fn().mockImplementation(() => ({
      maybeSingle: applicationMaybeSingle,
    }));
    const applicationSelect = vi.fn().mockImplementation(() => ({ eq: applicationEq }));

    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const profileEq = vi.fn().mockImplementation(() => ({
      maybeSingle: profileMaybeSingle,
    }));
    const profileSelect = vi.fn().mockImplementation(() => ({ eq: profileEq }));
    const profileUpsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "organizer_applications") {
        return {
          select: applicationSelect,
        };
      }

      if (table === "profiles") {
        return {
          select: profileSelect,
          upsert: profileUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: null },
      error: {
        status: 429,
        code: "over_email_send_rate_limit",
        message: "email rate limit exceeded",
      },
    });
    const createUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: "profile-123",
        },
      },
      error: null,
    });

    const adminClient = {
      rpc: vi.fn(),
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail,
          createUser,
          listUsers: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    await expect(
      prepareOrganizerIdentityForApproval("app-123"),
    ).resolves.toEqual({
      profileId: "profile-123",
      invitedIdentity: false,
    });

    expect(inviteUserByEmail).toHaveBeenCalledWith("comprehensive-test@example.com", {
      data: {
        full_name: "QA Comprehensive Test",
      },
      redirectTo: "http://localhost:3000/auth/confirm?next=/auth/update-password",
    });
    expect(createUser).toHaveBeenCalledWith({
      email: "comprehensive-test@example.com",
      email_confirm: true,
      user_metadata: {
        full_name: "QA Comprehensive Test",
      },
    });
    expect(profileUpsert).toHaveBeenCalledWith(
      {
        id: "profile-123",
        email: "comprehensive-test@example.com",
        full_name: "QA Comprehensive Test",
        organization: "Comprehensive Testing Org",
      },
      { onConflict: "id" },
    );
  });

  test("prepareOrganizerIdentityForApproval re-links an auth-only user when the email already exists", async () => {
    const applicationMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "app-456",
        status: "pending",
        profile_id: null,
        applicant_full_name: "Existing Auth Organizer",
        organization_name: "Existing Auth Org",
        contact_email: "existing-auth@example.com",
        rejection_reason: null,
      },
      error: null,
    });
    const applicationEq = vi.fn().mockImplementation(() => ({
      maybeSingle: applicationMaybeSingle,
    }));
    const applicationSelect = vi.fn().mockImplementation(() => ({ eq: applicationEq }));

    const profileMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const profileEq = vi.fn().mockImplementation(() => ({
      maybeSingle: profileMaybeSingle,
    }));
    const profileSelect = vi.fn().mockImplementation(() => ({ eq: profileEq }));
    const profileUpsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn().mockImplementation((table: string) => {
      if (table === "organizer_applications") {
        return {
          select: applicationSelect,
        };
      }

      if (table === "profiles") {
        return {
          select: profileSelect,
          upsert: profileUpsert,
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    });

    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: null },
      error: {
        status: 422,
        code: "email_exists",
        message: "A user with this email address has already been registered",
      },
    });
    const listUsers = vi.fn().mockResolvedValue({
      data: {
        users: [
          {
            id: "profile-456",
            email: "existing-auth@example.com",
          },
        ],
        aud: "authenticated",
        nextPage: null,
        lastPage: 0,
        total: 1,
      },
      error: null,
    });

    const adminClient = {
      rpc: vi.fn(),
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail,
          createUser: vi.fn(),
          listUsers,
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    await expect(
      prepareOrganizerIdentityForApproval("app-456"),
    ).resolves.toEqual({
      profileId: "profile-456",
      invitedIdentity: false,
    });

    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 200 });
    expect(profileUpsert).toHaveBeenCalledWith(
      {
        id: "profile-456",
        email: "existing-auth@example.com",
        full_name: "Existing Auth Organizer",
        organization: "Existing Auth Org",
      },
      { onConflict: "id" },
    );
  });

  test("lookupOrganizerApplicationStatus fallback returns not_found for malformed tokens", async () => {
    const from = vi.fn();
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.lookup_organizer_application_status does not exist",
      },
    });

    const adminClient = {
      rpc,
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    const result = await lookupOrganizerApplicationStatus("deadbeef", "127.0.0.12");

    expect(result).toEqual({ machineCode: "not_found" });
    expect(from).not.toHaveBeenCalled();
  });

  test("submitOrganizerApplication returns a user-friendly error when organizer intake columns are unavailable", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: "column organizer_applications.contact_email does not exist",
      },
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const order = vi.fn().mockImplementation(() => ({ limit }));
    const eqStatus = vi.fn().mockImplementation(() => ({ order }));
    const ilike = vi.fn().mockImplementation(() => ({ eq: eqStatus }));
    const select = vi.fn().mockImplementation(() => ({ ilike }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
        update: vi.fn(),
        insert: vi.fn(),
      };
    });

    const rpc = vi.fn().mockImplementation(async (fnName: string) => {
      if (fnName === "insert_organizer_application_intake") {
        return {
          data: null,
          error: {
            code: "42883",
            message: "function public.insert_organizer_application_intake does not exist",
          },
        };
      }

      return { data: null, error: null };
    });

    const adminClient = {
      rpc,
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    await expect(
      submitOrganizerApplication({
        applicantFullName: "QA Organizer",
        organizationName: "QA Math Academy",
        contactEmail: "qa.organizer@example.com",
        contactPhone: "+1 555 123 4567",
        organizationType: "Academy",
        statement: "We organize fair and inclusive math competitions for students.",
        hasAcceptedDataPrivacyAct: true,
        hasAcceptedTerms: true,
        logoFile: null,
        profileId: null,
      }),
    ).rejects.toThrow("Organizer applications are temporarily unavailable. Please try again later.");
  });

  test("lookupOrganizerApplicationStatus fallback returns not_found when lookup columns are unavailable", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42703",
        message: "column organizer_applications.status_lookup_token_hash does not exist",
      },
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const gt = vi.fn().mockImplementation(() => ({ limit }));
    const eq = vi.fn().mockImplementation(() => ({ gt }));
    const select = vi.fn().mockImplementation(() => ({ eq }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.lookup_organizer_application_status does not exist",
      },
    });

    const adminClient = {
      rpc,
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    const result = await lookupOrganizerApplicationStatus("a".repeat(64), "127.0.0.13");

    expect(result).toEqual({ machineCode: "not_found" });
  });

  test("lookupOrganizerApplicationStatus fallback throttles repeated requests by token fingerprint and client IP", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    const limit = vi.fn().mockImplementation(() => ({ maybeSingle }));
    const gt = vi.fn().mockImplementation(() => ({ limit }));
    const eq = vi.fn().mockImplementation(() => ({ gt }));
    const select = vi.fn().mockImplementation(() => ({ eq }));

    const from = vi.fn().mockImplementation((table: string) => {
      if (table !== "organizer_applications") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select,
      };
    });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42883",
        message: "function public.lookup_organizer_application_status does not exist",
      },
    });

    const adminClient = {
      rpc,
      from,
      storage: {
        from: vi.fn(),
      },
      auth: {
        admin: {
          inviteUserByEmail: vi.fn(),
          generateLink: vi.fn(),
          resetPasswordForEmail: vi.fn(),
        },
      },
    };

    vi.mocked(createSupabaseClient).mockReturnValue(adminClient as never);

    const first = await lookupOrganizerApplicationStatus("b".repeat(64), "127.0.0.77");
    const second = await lookupOrganizerApplicationStatus("b".repeat(64), "127.0.0.77");

    expect(first).toEqual({ machineCode: "not_found" });
    expect(second).toEqual({ machineCode: "throttled" });
    expect(maybeSingle).toHaveBeenCalledTimes(1);
  });
});
