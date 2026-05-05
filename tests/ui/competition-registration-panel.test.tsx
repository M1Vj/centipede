// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CompetitionRegistrationPanel } from "@/components/competitions/registration-panel";
import type { DiscoverableCompetition } from "@/lib/competition/discovery";

const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function buildCompetition(format: DiscoverableCompetition["format"]): DiscoverableCompetition {
  return {
    id: "competition-1",
    name: "Spring Invitational",
    description: "Open field competition",
    instructions: "No calculators.",
    type: "open",
    format,
    status: "published",
    registrationStart: null,
    registrationEnd: null,
    startTime: null,
    endTime: null,
    durationMinutes: 90,
    attemptsAllowed: 1,
    maxParticipants: 40,
    participantsPerTeam: 4,
    maxTeams: 10,
  };
}

describe("CompetitionRegistrationPanel", () => {
  test("posts null teamId for individual registration even with leader teams present", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe("/api/mathlete/competition/register");
      expect(init?.method).toBe("POST");
      return {
        ok: true,
        json: async () => ({ tone: "success", message: "Registered." }),
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <CompetitionRegistrationPanel
        competition={buildCompetition("individual")}
        individualRegistration={null}
        teamRegistrations={[]}
        leaderTeams={[
          {
            id: "team-1",
            name: "Team One",
            teamCode: "T1",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Register now" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({
      competitionId: "competition-1",
      teamId: null,
    });
  });

  test("posts selected teamId for team registration", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({ tone: "success", message: "Registered." }),
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <CompetitionRegistrationPanel
        competition={buildCompetition("team")}
        individualRegistration={null}
        teamRegistrations={[]}
        leaderTeams={[
          {
            id: "team-1",
            name: "Team One",
            teamCode: "T1",
          },
          {
            id: "team-2",
            name: "Team Two",
            teamCode: "T2",
          },
        ]}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Select team"), "team-2");
    await user.click(screen.getByRole("button", { name: "Register now" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body).toMatchObject({
      competitionId: "competition-1",
      teamId: "team-2",
    });
  });

  test("blocks registering another team when already registered through any active team", () => {
    render(
      <CompetitionRegistrationPanel
        competition={buildCompetition("team")}
        individualRegistration={null}
        teamRegistrations={[
          {
            id: "registration-1",
            competition_id: "competition-1",
            team_id: "team-registered",
            status: "registered",
            status_reason: null,
          },
        ]}
        leaderTeams={[
          {
            id: "team-other",
            name: "Other Team",
            teamCode: "OT",
          },
        ]}
      />,
    );

    expect(screen.getByText("You are registered for this competition.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Register now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeDisabled();
  });
});
