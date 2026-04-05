import { describe, expect, test } from "vitest";
import {
  mergeDedupeSortUsersByCreatedAtDesc,
  sanitizeUserSearchTerm,
} from "@/lib/admin/user-search";
import {
  checkOrganizerProvisioning,
  needsProvisioningRetry,
} from "@/lib/admin/organizer-provisioning";

describe("admin user search helpers", () => {
  test("sanitizeUserSearchTerm removes special operators and normalizes whitespace", () => {
    const result = sanitizeUserSearchTerm("  Jane%(Doe),  'admin'   ");

    expect(result).toBe("Jane Doe admin");
  });

  test("mergeDedupeSortUsersByCreatedAtDesc merges, dedupes, and sorts newest first", () => {
    const fullNameMatches = [
      { id: "user-b", created_at: "2026-01-02T09:00:00.000Z" },
      { id: "user-c", created_at: "2026-01-01T09:00:00.000Z" },
    ];
    const emailMatches = [
      { id: "user-a", created_at: "2026-01-03T09:00:00.000Z" },
      { id: "user-b", created_at: "2026-01-04T09:00:00.000Z" },
    ];

    const result = mergeDedupeSortUsersByCreatedAtDesc(fullNameMatches, emailMatches);

    expect(result.map((row) => row.id)).toEqual(["user-b", "user-a", "user-c"]);
    expect(result).toHaveLength(3);
  });

  test("mergeDedupeSortUsersByCreatedAtDesc uses id for deterministic tie-breaks", () => {
    const sameTimestamp = "2026-01-05T10:00:00.000Z";

    const result = mergeDedupeSortUsersByCreatedAtDesc(
      [{ id: "user-z", created_at: sameTimestamp }],
      [{ id: "user-a", created_at: sameTimestamp }],
    );

    expect(result.map((row) => row.id)).toEqual(["user-a", "user-z"]);
  });
});

describe("organizer provisioning verification helpers", () => {
  test("checkOrganizerProvisioning returns ok only when organizer link is fully complete", () => {
    const result = checkOrganizerProvisioning({
      status: "approved",
      profileId: "profile-1",
      hasLinkedProfile: true,
      profileRole: "organizer",
      profileApprovedAt: "2026-04-05T12:00:00.000Z",
    });

    expect(result).toEqual({ ok: true });
    expect(
      needsProvisioningRetry({
        status: "approved",
        profileId: "profile-1",
        hasLinkedProfile: true,
        profileRole: "organizer",
        profileApprovedAt: "2026-04-05T12:00:00.000Z",
      }),
    ).toBe(false);
  });

  test("checkOrganizerProvisioning returns actionable failures for incomplete approved applications", () => {
    const missingLink = checkOrganizerProvisioning({
      status: "approved",
      profileId: null,
      hasLinkedProfile: false,
      profileRole: null,
      profileApprovedAt: null,
    });
    const wrongRole = checkOrganizerProvisioning({
      status: "approved",
      profileId: "profile-2",
      hasLinkedProfile: true,
      profileRole: "mathlete",
      profileApprovedAt: "2026-04-05T12:00:00.000Z",
    });
    const missingApprovedAt = checkOrganizerProvisioning({
      status: "approved",
      profileId: "profile-3",
      hasLinkedProfile: true,
      profileRole: "organizer",
      profileApprovedAt: null,
    });

    expect(missingLink).toMatchObject({ ok: false, code: "missing_profile_link" });
    expect(wrongRole).toMatchObject({ ok: false, code: "role_mismatch" });
    expect(missingApprovedAt).toMatchObject({ ok: false, code: "missing_approved_at" });
    expect(
      needsProvisioningRetry({
        status: "approved",
        profileId: "profile-3",
        hasLinkedProfile: true,
        profileRole: "organizer",
        profileApprovedAt: null,
      }),
    ).toBe(true);
  });

  test("needsProvisioningRetry remains false for non-approved applications", () => {
    const pendingResult = checkOrganizerProvisioning({
      status: "pending",
      profileId: null,
      hasLinkedProfile: false,
      profileRole: null,
      profileApprovedAt: null,
    });

    expect(pendingResult).toMatchObject({ ok: false, code: "not_approved" });
    expect(
      needsProvisioningRetry({
        status: "pending",
        profileId: null,
        hasLinkedProfile: false,
        profileRole: null,
        profileApprovedAt: null,
      }),
    ).toBe(false);
  });
});
