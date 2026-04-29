// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { MathleteDashboardOverview } from "@/components/mathlete/dashboard-overview";

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("MathleteDashboardOverview", () => {
  test("hides upcoming cards whose countdown has reached zero", () => {
    render(
      <MathleteDashboardOverview
        displayName="Ava"
        profileComplete
        liveCards={[]}
        registrationCards={[]}
        activityItems={[]}
        upcomingCards={[
          {
            id: "expired-competition",
            title: "Expired Competition",
            type: "Individual",
            dateLabel: "Apr 29, 2026",
            timestamp: "2026-04-29T10:00:00.000Z",
            countdown: { days: "00", hours: "00", minutes: "00" },
            href: "/mathlete/competition/expired-competition",
          },
          {
            id: "active-competition",
            title: "Active Competition",
            type: "Individual",
            dateLabel: "Apr 29, 2026",
            timestamp: "2026-04-29T11:00:00.000Z",
            countdown: { days: "00", hours: "01", minutes: "00" },
            href: "/mathlete/competition/active-competition",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Active Competition", level: 3 })).toBeInTheDocument();
    expect(screen.queryByText("Expired Competition")).not.toBeInTheDocument();
  });
});