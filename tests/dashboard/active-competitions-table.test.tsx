// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { ActiveCompetitionsTable } from "@/components/dashboard/active-competitions-table";

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    href,
    className,
    ...props
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
}));

describe("ActiveCompetitionsTable", () => {
  test("uses a neutral empty date cell instead of TBD for open competitions", () => {
    render(
      <ActiveCompetitionsTable
        competitions={[
          {
            id: "open-competition",
            name: "Open Competition",
            subtitle: "Open competition",
            status: "published",
            registrationCount: 0,
            capacity: null,
            dateLabel: null,
            href: "/organizer/competition/open-competition",
          },
        ]}
      />,
    );

    expect(screen.getByText("Open Competition")).toBeInTheDocument();
    expect(screen.queryByText("TBD")).not.toBeInTheDocument();
    expect(screen.getByLabelText("No scheduled date")).toBeInTheDocument();
  });
});
