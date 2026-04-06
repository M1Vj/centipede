import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST } from "@/app/api/organizer/applications/route";
import { submitOrganizerApplication } from "@/lib/organizer/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/organizer/lifecycle", () => ({
  submitOrganizerApplication: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

function makeRequest(formData: FormData) {
  return new Request("http://localhost/api/organizer/applications", {
    method: "POST",
    body: formData,
  });
}

function baseFormData() {
  const formData = new FormData();
  formData.set("applicantFullName", "Organizer Applicant");
  formData.set("organizationName", "Mathwiz Academy");
  formData.set("contactEmail", "organizer@example.com");
  formData.set("contactPhone", "+1 555 0101");
  formData.set("organizationType", "Academy");
  formData.set("statement", "We host competitions.");
  formData.set("hasAcceptedDataPrivacyAct", "true");
  formData.set("hasAcceptedTerms", "true");
  return formData;
}

describe("organizer applications route error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(createAdminClient).mockReturnValue(null as never);

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as never);
  });

  test("preserves known user-facing validation messages", async () => {
    vi.mocked(submitOrganizerApplication).mockRejectedValue(
      new Error("A valid contact email is required."),
    );

    const response = await POST(makeRequest(baseFormData()));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "submission_failed",
      message: "A valid contact email is required.",
    });
  });

  test("returns 503 for known temporary availability issues", async () => {
    vi.mocked(submitOrganizerApplication).mockRejectedValue(
      new Error("Organizer applications are temporarily unavailable. Please try again later."),
    );

    const response = await POST(makeRequest(baseFormData()));
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      code: "submission_failed",
      message: "Organizer applications are temporarily unavailable. Please try again later.",
    });
  });

  test("sanitizes unexpected backend errors", async () => {
    vi.mocked(submitOrganizerApplication).mockRejectedValue(
      new Error("column organizer_applications.status_lookup_token_hash does not exist"),
    );

    const response = await POST(makeRequest(baseFormData()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      code: "submission_failed",
      message: "Unable to submit organizer application.",
    });
  });
});
