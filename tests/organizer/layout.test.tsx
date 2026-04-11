// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { type ReactNode } from "react";
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
  }: {
    children: ReactNode;
    className?: string;
    href: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
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

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("gap-x-4");
    expect(nav).toHaveClass("gap-y-2");
    expect(nav).toHaveClass("md:gap-x-3");
    expect(nav).toHaveClass("md:gap-y-1");

    for (const label of ["Dashboard", "Problem Banks", "Scoring", "Profile", "Settings"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }

    for (const link of within(nav).getAllByRole("link")) {
      expect(link).toHaveClass("px-3");
      expect(link).toHaveClass("py-2");
      expect(link).toHaveClass("md:px-2");
      expect(link).toHaveClass("md:py-1");
    }

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

    const nav = screen.getByRole("navigation");
    expect(within(nav).getByRole("link", { name: "Apply" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Status" })).toBeInTheDocument();
    expect(within(nav).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(client.mocks.from).not.toHaveBeenCalled();
  });
});
