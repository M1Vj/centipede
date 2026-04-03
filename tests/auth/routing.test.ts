import { describe, expect, test } from "vitest";
import { getAuthRedirect } from "@/lib/auth/routing";

describe("getAuthRedirect", () => {
  test("redirects anonymous users away from protected routes", () => {
    expect(
      getAuthRedirect({
        pathname: "/mathlete",
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
    expect(
      getAuthRedirect({
        pathname: "/privacy",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
    expect(
      getAuthRedirect({
        pathname: "/terms",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
    expect(
      getAuthRedirect({
        pathname: "/organizer/apply",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
    expect(
      getAuthRedirect({
        pathname: "/organizer/status",
        isAuthenticated: false,
        hasCompletedProfile: false,
      }),
    ).toBeNull();
  });

  test("redirects authenticated users with incomplete profiles to completion", () => {
    expect(
      getAuthRedirect({
        pathname: "/mathlete",
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
    ).toBe("/mathlete");
  });

  test("redirects authenticated users on the home page to their dashboards", () => {
    expect(
      getAuthRedirect({
        pathname: "/",
        isAuthenticated: true,
        hasCompletedProfile: true,
        role: "admin",
      }),
    ).toBe("/admin");
    expect(
      getAuthRedirect({
        pathname: "/",
        isAuthenticated: true,
        hasCompletedProfile: true,
        role: "organizer",
      }),
    ).toBe("/organizer");
    expect(
      getAuthRedirect({
        pathname: "/",
        isAuthenticated: true,
        hasCompletedProfile: true,
      }),
    ).toBe("/mathlete");
  });

  test("redirects admins with completed profiles to the admin portal", () => {
    expect(
      getAuthRedirect({
        pathname: "/auth/login",
        isAuthenticated: true,
        hasCompletedProfile: true,
        role: "admin",
      }),
    ).toBe("/admin");
    expect(
      getAuthRedirect({
        pathname: "/profile/complete",
        isAuthenticated: true,
        hasCompletedProfile: true,
        role: "admin",
      }),
    ).toBe("/admin");
  });

  test("redirects organizers with completed profiles to the organizer portal", () => {
    expect(
      getAuthRedirect({
        pathname: "/auth/login",
        isAuthenticated: true,
        hasCompletedProfile: true,
        role: "organizer",
      }),
    ).toBe("/organizer");
  });
});
