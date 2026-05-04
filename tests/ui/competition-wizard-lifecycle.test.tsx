import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import type { CompetitionRecord } from "@/lib/competition/types";

const routerSpies = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerSpies,
}));

vi.mock("@/components/ui/progress-link", () => ({
  ProgressLink: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

function buildInitialCompetition(status: CompetitionRecord["status"]): CompetitionRecord {
  return {
    id: "competition-1",
    organizerId: "organizer-1",
    name: "Open Lifecycle",
    description: "Lifecycle test",
    instructions: "Follow instructions",
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
    maxParticipants: 3,
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
    safeExamBrowserMode: "off",
    safeExamBrowserConfigKeyHashes: [],
    scoringSnapshotJson: null,
    draftRevision: 1,
    draftVersion: 1,
    isDeleted: false,
    publishedAt: null,
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };
}

function renderWizard() {
  const initialState = {
    ...createDefaultCompetitionDraftState(),
    name: "Open Lifecycle",
    description: "Lifecycle test",
    instructions: "Follow instructions",
    type: "open" as const,
  };

  return render(
    <CompetitionWizard
      mode="edit"
      competitionId="competition-1"
      initialState={initialState}
      initialCompetition={buildInitialCompetition("published")}
      availableProblems={[]}
    />,
  );
}

describe("CompetitionWizard lifecycle error and sync behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("closes start confirmation and surfaces error when start request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "service_unavailable",
            message: "Competition lifecycle mutations are temporarily unavailable while database migrations are incomplete.",
          }),
          {
            status: 503,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Start competition?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Start competition?" })).not.toBeInTheDocument();
    });

    expect(
      await screen.findByText(
        "Competition lifecycle mutations are temporarily unavailable while database migrations are incomplete.",
      ),
    ).toBeInTheDocument();
    expect(routerSpies.refresh).toHaveBeenCalledTimes(1);
  });

  test("prefers lifecycle status over stale competition status after start", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "ok",
            competition: {
              status: "published",
            },
            lifecycle: {
              machineCode: "ok",
              status: "live",
              draftRevision: 1,
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Start competition?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Start" }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog", { name: "Start competition?" })).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "End" })).toBeEnabled();
    });

    expect(screen.getByText("Competition started.")).toBeInTheDocument();
    expect(routerSpies.refresh).toHaveBeenCalledTimes(1);
  });
});
