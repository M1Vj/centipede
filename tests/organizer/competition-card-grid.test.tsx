// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionCardGrid } from "@/components/organizer/competition-card-grid";
import type { CompetitionRecord } from "@/lib/competition/types";

const routerRefreshMock = vi.fn();
const fetchMock = vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ code: "ok" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  }),
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

function buildCompetition(status: CompetitionRecord["status"], overrides: Partial<CompetitionRecord> = {}): CompetitionRecord {
  return {
    id: `${status}-competition`,
    organizerId: "organizer-1",
    name: `${status === "draft" ? "Draft" : "Published"} Competition`,
    description: "Competition description",
    instructions: "Competition instructions",
    type: "open",
    format: "individual",
    status,
    answerKeyVisibility: "after_end",
    registrationStart: null,
    registrationEnd: null,
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    attemptsAllowed: 1,
    multiAttemptGradingMode: "highest_score",
    maxParticipants: 10,
    participantsPerTeam: null,
    maxTeams: null,
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
    publishedAt: null,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

describe("CompetitionCardGrid delete flow", () => {
  beforeEach(() => {
    routerRefreshMock.mockReset();
    fetchMock.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "dashboard-delete-token"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("deletes draft competition after confirmation and refreshes dashboard", async () => {
    const user = userEvent.setup();

    render(
      <CompetitionCardGrid
        competitions={[
          buildCompetition("draft"),
          buildCompetition("published", { id: "published-competition", name: "Published Competition" }),
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "Delete competition unavailable" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Delete draft competition" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Delete draft?" });
    expect(dialog).toHaveTextContent(
      'This will remove "Draft Competition" from your organizer workspace. Published competitions are not affected.',
    );

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/organizer/competitions/draft-competition", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "x-idempotency-key": "dashboard-delete-token",
        },
      });
    });

    await waitFor(() => {
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText("Draft Competition")).not.toBeInTheDocument();
  });
});
