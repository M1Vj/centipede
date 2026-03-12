import { describe, expect, test } from "vitest";
import { getAuthRedirect } from "@/lib/auth/routing";

describe("getAuthRedirect", () => {
  test("redirects anonymous users away from protected routes", () => {
    expect(
      getAuthRedirect({
        pathname: "/protected",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBe("/auth/login");
  });

  test("allows anonymous users onto public routes", () => {
    expect(
      getAuthRedirect({
        pathname: "/auth/login",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
    expect(
      getAuthRedirect({
        pathname: "/",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
  });

  test("redirects authenticated users with incomplete profiles to completion", () => {
    expect(
      getAuthRedirect({
        pathname: "/protected",
        isAuthenticated: true,
        hasCompletedProfile: false,
      }),
    ).toBe("/profile/complete");
    expect(
      getAuthRedirect({
        pathname: "/",
        isAuthenticated: true,
        hasCompletedProfile: false,
      }),
    ).toBe("/profile/complete");
  });

  test("keeps authenticated users on the completion page until the profile is done", () => {
    expect(
      getAuthRedirect({
        pathname: "/profile/complete",
        isAuthenticated: true,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
  });

  test("redirects authenticated users with completed profiles away from auth pages", () => {
    expect(
      getAuthRedirect({
        pathname: "/auth/login",
        isAuthenticated: true,
        hasCompletedProfile: true,
      }),
    ).toBe("/");
    expect(
      getAuthRedirect({
        pathname: "/profile/complete",
        isAuthenticated: true,
        hasCompletedProfile: true,
      }),
    ).toBe("/");
  });
});
