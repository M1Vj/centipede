import { describe, expect, test } from "vitest";
import {
  getLogoExtensionForMimeType,
  validateLogoUpload,
  validateOrganizerApplicationInput,
} from "@/lib/organizer/validation";
import {
  hashStatusLookupToken,
  normalizeStatusLookupToken,
} from "@/lib/organizer/tokens";

describe("validateOrganizerApplicationInput", () => {
  test("accepts valid organizer application payload", () => {
    const validated = validateOrganizerApplicationInput({
      applicantFullName: "Vj Mabansag",
      organizationName: "Mathwiz Academy",
      contactEmail: "ORGANIZER@EXAMPLE.COM",
      contactPhone: "+63 900 000 0000",
      organizationType: "School",
      statement: "We organize regional mathematics events.",
      hasAcceptedDataPrivacyAct: true,
      hasAcceptedTerms: true,
    });

    expect(validated.contactEmail).toBe("organizer@example.com");
  });

  test("rejects missing legal consent", () => {
    expect(() =>
      validateOrganizerApplicationInput({
        applicantFullName: "Vj Mabansag",
        organizationName: "Mathwiz Academy",
        contactEmail: "organizer@example.com",
        contactPhone: "+63 900 000 0000",
        organizationType: "School",
        statement: "We organize regional mathematics events.",
        hasAcceptedDataPrivacyAct: false,
        hasAcceptedTerms: true,
      }),
    ).toThrow(/Data Privacy Act/);
  });
});

describe("validateLogoUpload", () => {
  test("returns null when no logo is provided", () => {
    expect(validateLogoUpload(null)).toBeNull();
  });

  test("returns extension for jpeg and png", () => {
    expect(getLogoExtensionForMimeType("image/jpeg")).toBe("jpg");
    expect(getLogoExtensionForMimeType("image/png")).toBe("png");
  });

  test("rejects unsupported file type", () => {
    const file = {
      name: "logo.gif",
      type: "image/gif",
      size: 100,
    } as File;
    expect(() => validateLogoUpload(file)).toThrow(/JPEG and PNG/);
  });

  test("rejects oversized file", () => {
    const file = {
      name: "logo.png",
      type: "image/png",
      size: 2 * 1024 * 1024 + 1,
    } as File;

    expect(() => validateLogoUpload(file)).toThrow(/2MB/);
  });
});

describe("status lookup tokens", () => {
  test("normalizes and hashes a valid token", () => {
    const normalized = normalizeStatusLookupToken("  ABCDEF1234567890abcdef1234567890  ");
    expect(normalized).toBe("abcdef1234567890abcdef1234567890");
    expect(hashStatusLookupToken(normalized)).toHaveLength(64);
  });

  test("returns null hash for invalid token", () => {
    expect(hashStatusLookupToken("not-valid-token")).toBeNull();
  });
});
