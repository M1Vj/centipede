// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { CompetitionDetailPanel } from "@/components/competitions/competition-detail-panel";
import { CompetitionList } from "@/components/competitions/competition-list";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({
    children,
    href,
    className,
  }: {
    children: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function buildCompetition(
  overrides: Partial<DiscoverableCompetition> = {},
): DiscoverableCompetition {
  return {
    id: "competition-1",
    name: "Open Algebra Sprint",
    description: "Solve problems at your own pace.",
    instructions: "Answer all questions.",
    type: "open",
    format: "individual",
    status: "published",
    registrationStart: null,
    registrationEnd: null,
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    attemptsAllowed: 1,
    maxParticipants: null,
    participantsPerTeam: null,
    maxTeams: null,
    ...overrides,
  };
}

describe("competition discovery UI", () => {
  const scheduledStartTime = "2026-05-10T12:00:00.000Z";

  test("omits TBD schedule indicators for open competition cards", () => {
    render(
      <CompetitionList
        competitions={[buildCompetition()]}
        registrationLookup={{}}
      />,
    );

    expect(screen.getByText("Open Algebra Sprint")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.queryByText("TBD")).not.toBeInTheDocument();
  });

  test("omits format pills for open competition cards", () => {
    render(
      <CompetitionList
        competitions={[buildCompetition()]}
        registrationLookup={{}}
      />,
    );

    expect(screen.getByText("Open Algebra Sprint")).toBeInTheDocument();
    expect(screen.queryByText("Individual")).not.toBeInTheDocument();
  });

  test("keeps format and schedule metadata for scheduled competition cards", () => {
    render(
      <CompetitionList
        competitions={[
          buildCompetition({
            id: "scheduled-team-competition",
            name: "Scheduled Team Relay",
            type: "scheduled",
            format: "team",
            participantsPerTeam: 3,
            startTime: scheduledStartTime,
          }),
        ]}
        registrationLookup={{}}
      />,
    );

    expect(screen.getByText("Scheduled Team Relay")).toBeInTheDocument();
    expect(screen.getByText("Team (3)")).toBeInTheDocument();
    expect(
      screen.getByText(
        new Date(scheduledStartTime).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      ),
    ).toBeInTheDocument();
  });

  test("omits schedule panels for open competition details", () => {
    render(<CompetitionDetailPanel competition={buildCompetition()} />);

    expect(screen.getByText("Open Algebra Sprint")).toBeInTheDocument();
    expect(screen.queryByText("Schedule")).not.toBeInTheDocument();
    expect(screen.queryByText("Competition start")).not.toBeInTheDocument();
    expect(screen.queryByText("TBD")).not.toBeInTheDocument();
  });
});
