import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  lookupOrganizerApplicationStatus,
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

    const result = await lookupOrganizerApplicationStatus("a".repeat(64), "127.0.0.1");

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

    const result = await lookupOrganizerApplicationStatus("deadbeef", "127.0.0.1");

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

    const result = await lookupOrganizerApplicationStatus("a".repeat(64), "127.0.0.1");

    expect(result).toEqual({ machineCode: "not_found" });
  });
});