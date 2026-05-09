// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { MathleteWorkspaceNav } from "@/components/mathlete/workspace-nav";

vi.mock("next/navigation", () => ({
  usePathname: () => "/mathlete",
}));

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    className,
    href,
    onClick,
    role,
  }: {
    children: ReactNode;
    className?: string;
    href: string;
    onClick?: () => void;
    role?: string;
  }) => (
    <a href={href} className={className} onClick={onClick} role={role}>
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

describe("MathleteWorkspaceNav", () => {
  test("omits dashboard anchor shortcuts from primary navigation", () => {
    render(<MathleteWorkspaceNav unreadCount={4} />);

    expect(screen.getByRole("button", { name: "Mathlete notifications, 4 unread" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/mathlete");
    expect(screen.getByRole("link", { name: "Competitions" })).toHaveAttribute(
      "href",
      "/mathlete/competition",
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", "/mathlete/history");
    expect(screen.queryByRole("link", { name: "Registrations" })).not.toBeInTheDocument();
  });
});
