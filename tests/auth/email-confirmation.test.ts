import { describe, expect, test, vi } from "vitest";
import { resolveEmailConfirmationRedirect } from "@/lib/auth/email-confirmation";

describe("resolveEmailConfirmationRedirect", () => {
  test("returns the requested in-app destination when the session is ready", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
          error: null,
        }),
      },
    };

    await expect(
      resolveEmailConfirmationRedirect({
        client,
        next: "/profile/complete",
      }),
    ).resolves.toBe("/profile/complete");
  });

  test("falls back to home when the next destination is unsafe", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-123",
            },
          },
          error: null,
        }),
      },
    };

    await expect(
      resolveEmailConfirmationRedirect({
        client,
        next: "https://example.com/phishing",
      }),
    ).resolves.toBe("/");
  });

  test("throws when the email confirmation link did not establish a session", async () => {
    const client = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: null,
          },
          error: null,
        }),
      },
    };

    await expect(
      resolveEmailConfirmationRedirect({
        client,
        next: "/profile/complete",
      }),
    ).rejects.toThrow("We couldn't finish signing you in from the email link.");
  });
});
