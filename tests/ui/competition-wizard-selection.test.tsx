import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";
import type { CompetitionProblemOption } from "@/lib/competition/types";

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

describe("CompetitionWizard selection and custom scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("supports bulk visible selection and removes duplicate scoring explanation card", () => {
    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: "Select visible" }));

    expect(screen.getByText("3 selected. Publish requires 10 to 100.")).toBeInTheDocument();
    expect(screen.queryByText("How your score is computed")).not.toBeInTheDocument();
    expect(screen.getByText("Scoring summary")).toBeInTheDocument();
  });

  test("lets organizers assign custom points from selected problems", () => {
    renderWizard({
      ...createDefaultCompetitionDraftState(),
      scoringMode: "custom",
      selectedProblemIds: ["problem-1"],
    });

    const pointsInput = screen.getByLabelText("Custom points for First problem");
    fireEvent.change(pointsInput, { target: { value: "7" } });

    expect(pointsInput).toHaveValue(7);
  });
});
