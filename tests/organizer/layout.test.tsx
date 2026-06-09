// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import OrganizerLayout from "@/app/organizer/layout";
import { fetchNotificationPreviewSnapshot } from "@/lib/notifications/preview";

vi.mock("@/lib/notifications/actions", () => ({
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("@/lib/notifications/preview", () => ({
  fetchNotificationPreviewSnapshot: vi.fn(),
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

const mockUseAuth = vi.fn(() => ({
  profile: { role: "organizer" },
}));

vi.mock("@/components/providers/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("organizer layout navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("keeps organizer IA and applies mobile-friendly nav spacing for organizer users", async () => {
    mockUseAuth.mockReturnValue({ profile: { role: "organizer" } });
    vi.mocked(fetchNotificationPreviewSnapshot).mockResolvedValue({
      notifications: [],
      unreadCount: 3,
      userId: "organizer-1",
    });

    render(
      await OrganizerLayout({
        children: <main>Organizer content</main>,
      }),
    );

    const [shellNav] = screen.getAllByRole("navigation");
    const nav = screen.getByRole("navigation", { name: "Organizer navigation" });
    expect(shellNav).toHaveClass("rounded-full");
    expect(nav).toHaveClass("gap-10");
    expect(screen.getByRole("button", { name: "Organizer notifications, 3 unread" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open organizer navigation" })).toBeInTheDocument();

    for (const label of ["Dashboard", "Competitions", "Problembanks", "History", "Profile", "Settings"]) {
      expect(within(nav).getByRole("link", { name: label })).toBeInTheDocument();
    }

    for (const label of ["Dashboard", "Competitions", "Problembanks", "History"]) {
      expect(within(nav).getByRole("link", { name: label })).toHaveClass("font-semibold");
    }

    expect(fetchNotificationPreviewSnapshot).toHaveBeenCalled();
  });

  test("keeps guest organizer IA links for unauthenticated sessions", async () => {
    mockUseAuth.mockReturnValue({ profile: null });
    vi.mocked(fetchNotificationPreviewSnapshot).mockResolvedValue({
      notifications: [],
      unreadCount: 0,
      userId: null,
    });

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
  });
});
