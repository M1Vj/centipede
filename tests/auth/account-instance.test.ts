// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  claimAccountInstance,
  getAccountInstanceRecord,
  isAccountOpenInAnotherInstance,
  releaseAccountInstance,
} from "@/lib/auth/account-instance";

describe("account instance helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("instance-1")
      .mockReturnValueOnce("instance-2");
  });

  test("does not report the current tab as a conflicting account instance", () => {
    claimAccountInstance("user-1", 1_000);

    expect(isAccountOpenInAnotherInstance("user-1", 2_000)).toBe(false);
  });

  test("detects a fresh owner from another tab", () => {
    claimAccountInstance("user-1", 1_000);
    window.sessionStorage.clear();

    expect(isAccountOpenInAnotherInstance("user-1", 2_000)).toBe(true);
  });

  test("ignores expired owners and only releases the current owner", () => {
    claimAccountInstance("user-1", 1_000);
    window.sessionStorage.clear();

    expect(isAccountOpenInAnotherInstance("user-1", 20_000)).toBe(false);
    releaseAccountInstance("user-1");

    expect(getAccountInstanceRecord("user-1")).not.toBeNull();
  });
});
