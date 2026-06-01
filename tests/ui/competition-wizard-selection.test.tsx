import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import type { CompetitionProblemOption, CompetitionRecord } from "@/lib/competition/types";

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

function buildProblem(id: string, bankId: string, bankName: string, contentLatex: string): CompetitionProblemOption {
  return {
    id,
    bankId,
    bankName,
    type: "identification",
    difficulty: "average",
    isDeleted: false,
    tags: ["algebra"],
    contentLatex,
    explanationLatex: "",
    authoringNotes: "",
    imagePath: null,
    options: null,
    answerKey: {
      acceptedAnswers: ["1"],
    },
    createdAt: "2026-04-15T00:00:00.000Z",
    updatedAt: "2026-04-15T00:00:00.000Z",
  };
}

function renderWizard(initialState = createDefaultCompetitionDraftState()) {
  return render(
    <CompetitionWizard
      mode="create"
      initialState={initialState}
      availableProblems={[
        buildProblem("problem-1", "bank-a", "Bank A", "First problem"),
        buildProblem("problem-2", "bank-a", "Bank A", "Second problem"),
        buildProblem("problem-3", "bank-b", "Bank B", "Third problem"),
      ]}
    />,
  );
}

function buildPublishReadyDraft() {
  return {
    ...createDefaultCompetitionDraftState(),
    type: "open" as const,
    format: "individual" as const,
    name: "Open Algebra Cup",
    description: "A publish-ready competition draft.",
    instructions: "Solve all problems independently.",
    attemptsAllowed: 1,
    maxParticipants: 20,
    selectedProblemIds: Array.from({ length: 10 }, (_, index) => `problem-${index + 1}`),
  };
}

function buildCompetitionRecord(): CompetitionRecord {
  const now = "2026-04-15T00:00:00.000Z";

  return {
    id: "competition-1",
    organizerId: "organizer-1",
    leaderboardPublished: false,
    name: "Open Algebra Cup",
    description: "A publish-ready competition draft.",
    instructions: "Solve all problems independently.",
    type: "open",
    format: "individual",
    status: "draft",
    answerKeyVisibility: "after_end",
    registrationStart: null,
    registrationEnd: null,
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    attemptsAllowed: 1,
    multiAttemptGradingMode: "highest_score",
    maxParticipants: 20,
    participantsPerTeam: null,
    maxTeams: null,
    scoringMode: "difficulty",
    customPointsByProblemId: {},
    penaltyMode: "none",
    deductionValue: 0,
    tieBreaker: "earliest_final_submission",
    shuffleQuestions: false,
    shuffleOptions: false,
    safeExamBrowserMode: "off",
    safeExamBrowserConfigKeyHashes: [],
    scoringSnapshotJson: null,
    draftRevision: 1,
    draftVersion: 1,
    isDeleted: false,
    publishedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

function openProblemsStep() {
  fireEvent.click(screen.getByRole("button", { name: "Problems" }));
}

describe("CompetitionWizard selection and custom scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("supports bulk visible selection and removes duplicate scoring explanation card", () => {
    renderWizard();
    openProblemsStep();

    fireEvent.click(screen.getByRole("button", { name: "Select all visible" }));

    expect(screen.getByText("3 selected. Publish requires 10 to 100.")).toBeInTheDocument();
    expect(screen.queryByText("How your score is computed")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scoring" }));
    expect(screen.getByText("Scoring summary")).toBeInTheDocument();
  });

  test("shows one expanded problem bank at a time", async () => {
    renderWizard();
    openProblemsStep();

    await waitFor(() => {
      expect(screen.getByText("First problem")).toBeInTheDocument();
    });
    expect(screen.queryByText("Third problem")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Bank B/i }));

    await waitFor(() => {
      expect(screen.getByText("Third problem")).toBeInTheDocument();
      expect(screen.queryByText("First problem")).not.toBeInTheDocument();
    });
  });

  test("lets organizers assign custom points from selected problems", () => {
    renderWizard({
      ...createDefaultCompetitionDraftState(),
      scoringMode: "custom",
      selectedProblemIds: ["problem-1"],
    });
    openProblemsStep();

    const pointsInput = screen.getByLabelText("Custom points for First problem");
    fireEvent.change(pointsInput, { target: { value: "7" } });

    expect(pointsInput).toHaveValue(7);
  });

  test("warns and blocks publish when selected problems contain invalid LaTeX", () => {
    const initialState = buildPublishReadyDraft();
    const availableProblems = Array.from({ length: 10 }, (_, index) =>
      buildProblem(
        `problem-${index + 1}`,
        "bank-a",
        "Bank A",
        index === 0 ? "\\frac{1}{" : `Valid problem ${index + 1}`,
      ),
    );

    render(
      <CompetitionWizard
        mode="edit"
        competitionId="competition-1"
        initialState={initialState}
        initialCompetition={buildCompetitionRecord()}
        availableProblems={availableProblems}
      />,
    );

    openProblemsStep();

    expect(screen.getAllByText(/1 selected problem has invalid LaTeX/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Invalid LaTeX:/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByRole("button", { name: "Publish" })).toBeDisabled();
  });
});
