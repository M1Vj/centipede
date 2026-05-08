// @vitest-environment jsdom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionParticipantsPanel } from "@/components/organizer/competition-participants-panel";
import type {
  MonitoringAttemptSummary,
  MonitoringCompetitionEvent,
} from "@/components/monitoring/types";
import type { CompetitionRecord } from "@/lib/competition/types";
import type { OrganizerRegistrationDetail } from "@/lib/registrations/types";

const routerRefreshMock = vi.fn();
const fetchMock = vi.fn();

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
  leaderboardPublished: false,
  name: "Regional Math Finals",
  description: "Competition description",
  instructions: "Competition instructions",
  type: "open",
  format: "team",
  status: "live",
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
  safeExamBrowserMode: "off",
  safeExamBrowserConfigKeyHashes: [],
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

const activeAttempts: MonitoringAttemptSummary[] = [
  {
    attemptId: "attempt-1",
    registrationId: "registration-1",
    displayName: "Euler Squad",
    status: "in_progress",
    score: 72,
    maxScore: 100,
    startedAt: "2026-04-26T00:05:00.000Z",
    lastSeenAt: "2026-04-26T00:44:00.000Z",
    elapsedSeconds: 2340,
    remainingSeconds: 1260,
    offenseCount: 3,
    answeredCount: 18,
    totalQuestions: 20,
    progressPercent: 90,
    riskLevel: "high",
  },
  {
    attemptId: "attempt-2",
    registrationId: "registration-2",
    displayName: "Noether Team",
    status: "in_progress",
    score: 21,
    maxScore: 100,
    startedAt: "2026-04-26T00:10:00.000Z",
    lastSeenAt: "2026-04-26T00:28:00.000Z",
    elapsedSeconds: 1080,
    remainingSeconds: 2520,
    offenseCount: 0,
    answeredCount: 4,
    totalQuestions: 20,
    progressPercent: 20,
    riskLevel: "medium",
  },
];

const events: MonitoringCompetitionEvent[] = [
  {
    id: "event-2",
    happenedAt: "2026-04-26T00:45:00.000Z",
    eventType: "competition_paused",
    controlAction: "pause_competition",
    reason: "Network degradation",
    actorName: "Organizer One",
    actorRole: "organizer",
    result: "approved",
    metadata: { request_idempotency_token: "token-2" },
  },
  {
    id: "event-1",
    happenedAt: "2026-04-26T00:15:00.000Z",
    eventType: "tab_switch_offense_logged",
    controlAction: null,
    reason: "Focus left arena",
    actorName: "System",
    actorRole: "system",
    result: "recorded",
    metadata: { attempt_id: "attempt-1" },
  },
];

function renderPanel(
  props: Partial<React.ComponentProps<typeof CompetitionParticipantsPanel>> = {},
) {
  return render(
    <CompetitionParticipantsPanel
      competition={competition}
      registrations={registrations}
      activeAttempts={activeAttempts}
      events={events}
      initialTab="participants"
      routePath="/organizer/competition/competition-1/participants"
      mode="organizer"
      {...props}
    />,
  );
}

describe("CompetitionParticipantsPanel", () => {
  beforeEach(() => {
    routerRefreshMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "monitoring-token"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("falls back to participants tab and renders stable route query links", () => {
    renderPanel({ initialTab: "unknown" });

    expect(screen.getByRole("heading", { name: "Regional Math Finals" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Participants/i })).toHaveAttribute(
      "href",
      "/organizer/competition/competition-1/participants?tab=participants",
    );
    expect(screen.getByRole("link", { name: /Announcements/i })).toHaveAttribute(
      "href",
      "/organizer/competition/competition-1/participants?tab=announcements",
    );
    expect(screen.getByRole("link", { name: /Timeline/i })).toHaveAttribute(
      "href",
      "/organizer/competition/competition-1/participants?tab=timeline",
    );
    expect(screen.getByRole("heading", { name: "Participant monitor" })).toBeInTheDocument();
  });

  test("filters participants by search and registration status while keeping active attempt summaries visible", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("Search participants"), "Euler");
    await user.selectOptions(screen.getByLabelText("Registration status"), "registered");

    expect(screen.getByText("Euler Squad")).toBeInTheDocument();
    expect(screen.queryByText("Noether Team")).not.toBeInTheDocument();
    expect(screen.getByText("Score 72 / 100")).toBeInTheDocument();
    expect(screen.getByText("Offenses 3")).toBeInTheDocument();
    expect(screen.getByText("High risk")).toBeInTheDocument();
    expect(screen.getByText("18 / 20 answered")).toBeInTheDocument();
  });

  test("submits announcement payload with explicit status message", async () => {
    const user = userEvent.setup();
    renderPanel({ initialTab: "announcements" });

    await user.type(screen.getByLabelText("Announcement title"), "Time extension");
    await user.type(screen.getByLabelText("Announcement body"), "Ten more minutes added.");
    await user.selectOptions(screen.getByLabelText("Audience"), "registered_only");
    await user.click(screen.getByRole("button", { name: "Send announcement" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/organizer/competitions/competition-1/monitoring/announce", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Time extension",
        body: "Ten more minutes added.",
        audience: "registered_only",
      }),
    });
    expect(await screen.findByText("Announcement queued for delivery.")).toBeInTheDocument();
  });

  test("requires reason before organizer pause confirmation posts idempotent control payload", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Pause competition" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Confirm pause" })).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Control reason"), "Power outage in venue");
    await user.click(within(dialog).getByRole("button", { name: "Confirm pause" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/organizer/competitions/competition-1/monitoring/pause", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "monitoring-token",
      },
      body: JSON.stringify({
        reason: "Power outage in venue",
      }),
    });
    expect(await screen.findByText("Pause request accepted.")).toBeInTheDocument();
  });

  test("blocks organizer pause for scheduled competitions while keeping monitoring controls visible", () => {
    renderPanel({
      competition: {
        ...competition,
        type: "scheduled",
      },
    });

    const pauseButton = screen.getByRole("button", { name: "Pause competition" });
    expect(pauseButton).toBeDisabled();
    expect(screen.getByText("Organizer pause is available only for open live competitions.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extend time" })).toBeEnabled();
    expect(screen.getAllByRole("button", { name: "Reset disconnect" })[0]).toBeEnabled();
  });

  test("disconnect reset requires objective evidence and posts canonical reset payload", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getAllByRole("button", { name: "Reset disconnect" })[0]);

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Confirm reset" })).toBeDisabled();

    await user.type(within(dialog).getByLabelText("Disconnect evidence event id"), "evidence-event-1");
    await user.type(within(dialog).getByLabelText("Control reason"), "Participant reconnected after platform drop");
    await user.click(within(dialog).getByRole("button", { name: "Confirm reset" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/organizer/competitions/competition-1/monitoring/reset-disconnect", {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "monitoring-token",
      },
      body: JSON.stringify({
        reason: "Participant reconnected after platform drop",
        attemptId: "attempt-1",
        disconnectEvidenceType: "attempt_heartbeat_timeout",
        disconnectEvidenceRef: "evidence-event-1",
      }),
    });
  });

  test("renders timeline entries chronologically with control metadata and empty state", () => {
    const { rerender } = renderPanel({ initialTab: "timeline" });

    const rows = screen.getAllByTestId("timeline-entry");
    expect(rows[0]).toHaveTextContent("competition_paused");
    expect(rows[0]).toHaveTextContent("pause_competition");
    expect(rows[0]).toHaveTextContent("Network degradation");
    expect(rows[0]).toHaveTextContent("Organizer One");
    expect(rows[0]).toHaveTextContent("approved");
    expect(rows[1]).toHaveTextContent("tab_switch_offense_logged");

    rerender(
      <CompetitionParticipantsPanel
        competition={competition}
        registrations={registrations}
        activeAttempts={[]}
        events={[]}
        initialTab="timeline"
        routePath="/organizer/competition/competition-1/participants"
        mode="organizer"
      />,
    );

    expect(screen.getByText("No competition events recorded yet.")).toBeInTheDocument();
  });

  test("admin mode only exposes force-pause and moderation delete controls", () => {
    renderPanel({
      mode: "admin",
      routePath: "/admin/competitions/competition-1/participants",
    });

    expect(screen.getByRole("button", { name: "Force pause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Moderation delete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume competition" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Extend time" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reset disconnect/i })).not.toBeInTheDocument();
  });
});
