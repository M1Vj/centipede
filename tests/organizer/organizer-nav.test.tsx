// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { OrganizerNav } from "@/components/organizer/organizer-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/organizer",
}));

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    className,
    href,
    onClick,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/logout-button", () => ({
  LogoutButton: ({ label, ariaLabel }: { label?: string; ariaLabel?: string }) => (
    <button type="button" aria-label={ariaLabel}>
      {label}
    </button>
  ),
}));

describe("OrganizerNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders organizer notification dropdown with accessible trigger and content", async () => {
    const user = userEvent.setup();

    render(<OrganizerNav isOrganizer isAuthenticated />);

    expect(screen.getByRole("button", { name: "Open organizer navigation" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Notifications" }));

    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(
      screen.getByText("No notifications yet. Organizer updates will appear here."),
    ).toBeInTheDocument();
  });

  test("keeps guest links and mobile toggle for unauthenticated organizer sessions", () => {
    render(<OrganizerNav isOrganizer={false} isAuthenticated={false} />);

    expect(screen.getByRole("link", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Status" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open organizer navigation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
  });
});
