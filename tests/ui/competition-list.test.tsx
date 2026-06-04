// @vitest-environment jsdom

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionDetailPanel } from "@/components/competitions/competition-detail-panel";
import { CompetitionFilters } from "@/components/competitions/competition-filters";
import { CompetitionList } from "@/components/competitions/competition-list";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

const routerReplaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: routerReplaceMock,
  }),
}));

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

  beforeEach(() => {
    routerReplaceMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("updates the search URL while typing without waiting for form submission", () => {
    vi.useFakeTimers();

    render(
      <CompetitionFilters
        actionPath="/mathlete/competition"
        filters={{ query: "", type: "all", format: "all", status: "all" }}
        total={2}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "algebra" },
    });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(routerReplaceMock).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(routerReplaceMock).toHaveBeenCalledWith("/mathlete/competition?q=algebra", {
      scroll: false,
    });
  });

  test("keeps selected filters and resets pagination when search updates", () => {
    vi.useFakeTimers();

    render(
      <CompetitionFilters
        actionPath="/mathlete/competition"
        filters={{ query: "algebra", type: "open", format: "team", status: "live" }}
        total={2}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search"), {
      target: { value: "geometry" },
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(routerReplaceMock).toHaveBeenCalledWith(
      "/mathlete/competition?q=geometry&type=open&format=team&status=live",
      { scroll: false },
    );
  });

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
