// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CompetitionCalendar } from "@/components/competitions/competition-calendar";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

function buildCompetition(
  overrides: Partial<DiscoverableCompetition> = {},
): DiscoverableCompetition {
  return {
    id: "competition-1",
    name: "Regional Algebra Sprint",
    description: "Solve problems at your own pace.",
    instructions: "Answer all questions.",
    type: "scheduled",
    format: "individual",
    status: "published",
    registrationStart: null,
    registrationEnd: null,
    startTime: "2026-05-10T12:00:00.000Z",
    endTime: null,
    durationMinutes: 60,
    attemptsAllowed: 1,
    maxParticipants: null,
    participantsPerTeam: null,
    maxTeams: null,
    ...overrides,
  };
}

describe("CompetitionCalendar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("renders weekday labels without duplicate React key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<CompetitionCalendar competitions={[buildCompetition()]} />);

    expect(screen.getByText("Regional Algebra Sprint")).toBeInTheDocument();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
