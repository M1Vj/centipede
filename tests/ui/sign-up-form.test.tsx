// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SignUpForm } from "@/components/sign-up-form";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  push: vi.fn(),
  signInWithOAuth: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/hooks/use-feedback-router", () => ({
  useFeedbackRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: mocks.getUser,
      signInWithOAuth: mocks.signInWithOAuth,
      signUp: mocks.signUp,
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mocks.maybeSingle,
        })),
      })),
    })),
  }),
}));

describe("SignUpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("redirects an already signed-in mathlete instead of creating another account", async () => {
    const user = userEvent.setup();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "mathlete-1" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "mathlete-1",
        email: "mathlete@example.com",
        full_name: "Mathlete User",
        school: "Math School",
        grade_level: "12",
        organization: null,
        approved_at: null,
        role: "mathlete",
        is_active: true,
      },
      error: null,
    });

    render(<SignUpForm />);

    await user.type(screen.getByLabelText("Email Address"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.type(screen.getByLabelText("Confirm Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/mathlete");
    });

    expect(mocks.signUp).not.toHaveBeenCalled();
    expect(
      screen.getByText("You are already signed in. Redirecting to your workspace..."),
    ).toBeInTheDocument();
  });

  test("redirects an already signed-in mathlete instead of starting Google registration", async () => {
    const user = userEvent.setup();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "mathlete-1" } },
      error: null,
    });
    mocks.maybeSingle.mockResolvedValue({
      data: {
        id: "mathlete-1",
        email: "mathlete@example.com",
        full_name: "Mathlete User",
        school: "Math School",
        grade_level: "12",
        organization: null,
        approved_at: null,
        role: "mathlete",
        is_active: true,
      },
      error: null,
    });

    render(<SignUpForm />);

    await user.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mocks.push).toHaveBeenCalledWith("/mathlete");
    });

    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });
});
