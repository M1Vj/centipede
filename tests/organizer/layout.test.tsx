// @vitest-environment jsdom

import { fireEvent, render, screen, within } from "@testing-library/react";
import { type AnchorHTMLAttributes, type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import OrganizerLayout from "@/app/organizer/layout";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    className,
    href,
    ...props
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/logout-button", () => ({
  LogoutButton: ({
    className,
    label = "Logout",
  }: {
    className?: string;
    label?: string;
  }) => (
    <button type="button" className={className}>
      {label}
    </button>
  ),
}));

function createSupabaseClientMock({
  role,
  userId,
}: {
  role?: string;
  userId: string | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: role ? { role } : null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: userId ? { id: userId } : null,
        },
      }),
    },
    from,
    mocks: { from },
  };
}

describe("organizer layout navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("keeps organizer IA and applies mobile-friendly nav spacing for organizer users", async () => {
    const client = createSupabaseClientMock({ userId: "organizer-1", role: "organizer" });
    vi.mocked(createClient).mockResolvedValue(client as never);

    render(
      await OrganizerLayout({
        children: <main>Organizer content</main>,
      }),
    );

    const nav = screen.getByRole("navigation", { name: "Organizer navigation" });
    expect(nav).toHaveClass("md:flex");
    expect(nav).toHaveClass("gap-2");
    expect(screen.getByRole("button", { name: "Open organizer navigation" })).toBeInTheDocument();

    for (const label of ["Dashboard", "Problem Banks", "Competitions", "Scoring"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }

    for (const link of within(nav).getAllByRole("link")) {
      expect(link).toHaveClass("organizer-nav-chip");
    }

    fireEvent.click(screen.getByRole("button", { name: "Open organizer profile menu" }));
    expect(screen.getByRole("menuitem", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
    expect(client.mocks.from).toHaveBeenCalledWith("profiles");
  });

  test("keeps guest organizer IA links for unauthenticated sessions", async () => {
    const client = createSupabaseClientMock({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    render(
      await OrganizerLayout({
        children: <main>Guest organizer content</main>,
      }),
    );

    const nav = screen.getByRole("navigation", { name: "Organizer navigation" });
    expect(within(nav).getByRole("link", { name: "Apply" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Status" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open organizer navigation" })).toBeInTheDocument();
    expect(client.mocks.from).not.toHaveBeenCalled();
  });
});
