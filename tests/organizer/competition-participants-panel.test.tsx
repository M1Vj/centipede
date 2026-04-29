// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionParticipantsPanel } from "@/components/organizer/competition-participants-panel";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { OrganizerRegistrationDetail } from "@/lib/registrations/types";

const routerRefreshMock = vi.fn();
const fetchMock = vi.fn().mockResolvedValue(
  new Response(
    JSON.stringify({
      code: "ok",
      competition: {
        status: "live",
      },
      lifecycle: {
        machineCode: "ok",
        status: "live",
      },
    }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  ),
);

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: routerRefreshMock,
  }),
}));

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const competition: CompetitionRecord = {
  id: "competition-1",
  organizerId: "organizer-1",
  name: "Regional Math Finals",
  description: "Competition description",
  instructions: "Competition instructions",
  type: "scheduled",
  format: "team",
  status: "published",
  answerKeyVisibility: "after_end",
  registrationStart: "2026-04-20T00:00:00.000Z",
  registrationEnd: "2026-04-25T00:00:00.000Z",
  startTime: "2026-04-26T00:00:00.000Z",
  endTime: "2026-04-26T01:00:00.000Z",
  durationMinutes: 60,
  attemptsAllowed: 1,
  multiAttemptGradingMode: "highest_score",
  maxParticipants: null,
  participantsPerTeam: 2,
  maxTeams: 4,
  scoringMode: "difficulty",
  customPointsByProblemId: {},
  penaltyMode: "none",
  deductionValue: 0,
  tieBreaker: "earliest_final_submission",
  shuffleQuestions: false,
  shuffleOptions: false,
  logTabSwitch: false,
  offensePenalties: [],
  scoringSnapshotJson: null,
  draftRevision: 1,
  draftVersion: 1,
  isDeleted: false,
  publishedAt: "2026-04-20T00:00:00.000Z",
  createdAt: "2026-04-15T00:00:00.000Z",
  updatedAt: "2026-04-20T00:00:00.000Z",
};

const registrations: OrganizerRegistrationDetail[] = [
  {
    id: "registration-1",
    competitionId: "competition-1",
    profileId: null,
    teamId: "team-1",
    participantType: "team",
    displayName: "Euler Squad",
    subtitle: "TEAMCODE01 / 2 members",
    status: "registered",
    statusReason: null,
    registeredAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
    roster: [
      {
        profileId: "profile-1",
        fullName: "Ada Lovelace",
        school: "Analytical Academy",
        gradeLevel: "11",
        role: "leader",
      },
      {
        profileId: "profile-2",
        fullName: "Grace Hopper",
        school: "Compiler High",
        gradeLevel: "12",
        role: "member",
      },
    ],
  },
  {
    id: "registration-2",
    competitionId: "competition-1",
    profileId: null,
    teamId: "team-2",
    participantType: "team",
    displayName: "Noether Team",
    subtitle: null,
    status: "ineligible",
    statusReason: "team_size_invalid",
    registeredAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
    roster: [],
  },
];

describe("CompetitionParticipantsPanel", () => {
  beforeEach(() => {
    routerRefreshMock.mockReset();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "participants-start-token"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders registration summary and roster snapshots", () => {
    render(
      <CompetitionParticipantsPanel
        competition={competition}
        registrations={registrations}
      />,
    );

    expect(screen.getByRole("heading", { name: "Regional Math Finals" })).toBeInTheDocument();
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    expect(screen.getByText("Euler Squad")).toBeInTheDocument();
    expect(screen.getByText("TEAMCODE01 / 2 members")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("Reason: team_size_invalid")).toBeInTheDocument();
  });

  test("starts an open published competition from the management panel", async () => {
    const user = userEvent.setup();

    render(
      <CompetitionParticipantsPanel
        competition={{
          ...competition,
          type: "open",
          format: "individual",
          startTime: null,
          endTime: null,
          maxParticipants: 20,
          maxTeams: null,
          participantsPerTeam: null,
        }}
        registrations={[]}
      />,
    );

    expect(screen.getByText("This open competition is published and ready to start.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start competition" }));
    await user.click(await screen.findByRole("button", { name: "Start" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/organizer/competitions/competition-1/start", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "x-idempotency-key": "participants-start-token",
      },
    });
    expect(await screen.findByText("Competition started.")).toBeInTheDocument();
    expect(screen.getByText("live")).toBeInTheDocument();
    expect(routerRefreshMock).toHaveBeenCalledTimes(1);
  });

  test("shows a disabled reason for scheduled published competitions", () => {
    render(
      <CompetitionParticipantsPanel
        competition={{
          ...competition,
          startTime: "2099-04-26T00:00:00.000Z",
        }}
        registrations={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "Start competition" })).toBeDisabled();
    expect(screen.getByText(/Scheduled competitions start automatically at/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
