import { describe, expect, test } from "vitest";
import {
  SESSION_VERSION_COOKIE,
  getSessionSignOutHref,
  getSessionVersionCookieValue,
  isActiveSessionCurrent,
  isSessionStale,
  parseSessionVersion,
} from "@/lib/auth/session";

describe("session helpers", () => {
  test("parses positive integer session versions", () => {
    expect(parseSessionVersion("3")).toBe(3);
    expect(parseSessionVersion(" 7 ")).toBe(7);
    expect(parseSessionVersion(11)).toBe(11);
  });

  test("rejects invalid session version values", () => {
    expect(parseSessionVersion("0")).toBeNull();
    expect(parseSessionVersion("-1")).toBeNull();
    expect(parseSessionVersion("abc")).toBeNull();
    expect(parseSessionVersion(null)).toBeNull();
  });

  test("reads the session version cookie from a cookie store", () => {
    const cookies = {
      get(name: string) {
        return name === SESSION_VERSION_COOKIE ? { value: "9" } : undefined;
      },
    };

    expect(getSessionVersionCookieValue(cookies)).toBe(9);
  });

  test("treats mismatched session versions as stale", () => {
    expect(
      isSessionStale(
        { session_version: 4 },
        { sessionVersion: 5 },
      ),
    ).toBe(true);
    expect(
      isSessionStale(
        { session_version: 4 },
        { sessionVersion: 4 },
      ),
    ).toBe(false);
  });

  test("keeps compatibility when the profile has no session version yet", () => {
    expect(
      isSessionStale(
        {},
        { sessionVersion: null },
      ),
    ).toBe(false);
  });

  test("detects whether an active session marker is still current", () => {
    const now = new Date("2026-06-03T08:00:00.000Z");

    expect(
      isActiveSessionCurrent(
        { active_session_expires_at: "2026-06-03T08:05:00.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isActiveSessionCurrent(
        { active_session_expires_at: "2026-06-03T07:55:00.000Z" },
        now,
      ),
    ).toBe(false);
    expect(isActiveSessionCurrent({}, now)).toBe(false);
  });

  test("builds stale-session sign-out href through the session-replaced page", () => {
    expect(getSessionSignOutHref("/auth/login")).toBe(
      "/auth/session-replaced?next=%2Fauth%2Flogin&reason=session_replaced",
    );
  });
});
