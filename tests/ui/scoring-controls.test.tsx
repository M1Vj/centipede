import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ScoringContractWorkbench } from "@/components/organizer/scoring-contract-workbench";
import { OrganizerScoringRuleControls } from "@/components/organizer/scoring-rule-controls";
import { ScoringSummaryCard } from "@/components/scoring/scoring-summary-card";
import { createDefaultScoringRuleConfig } from "@/lib/scoring/validation";

describe("scoring ui contracts", () => {
  test("wires field validation errors with aria-invalid and aria-describedby", () => {
    const config = {
      ...createDefaultScoringRuleConfig(),
      scoringMode: "custom" as const,
    };

    render(
      <OrganizerScoringRuleControls
        value={config}
        competitionType="open"
        onChange={vi.fn()}
        validationErrors={[
          { field: "scoringMode", reason: "Scoring mode error" },
          { field: "penaltyMode", reason: "Penalty mode error" },
          { field: "deductionValue", reason: "Deduction value error" },
          { field: "tieBreaker", reason: "Tie-breaker error" },
          { field: "multiAttemptGradingMode", reason: "Attempt mode error" },
          { field: "customPointsByProblemId", reason: "Custom points error" },
          { field: "offensePenalties", reason: "Offense penalties error" },
        ]}
      />,
    );

    expect(screen.getByLabelText("Scoring mode")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Scoring mode")).toHaveAttribute(
      "aria-describedby",
      "scoring-mode-error",
    );

    expect(screen.getByLabelText("Tie-breaker")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Wrong-answer penalty")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("Deduction value")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Open competition attempt policy")).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    const offensePenaltiesGroup = screen.getByRole("group", { name: "Offense penalties" });
    expect(offensePenaltiesGroup).toHaveAttribute("aria-invalid", "true");
    expect(offensePenaltiesGroup.getAttribute("aria-describedby")).toContain(
      "offense-penalties-error",
    );

    const customPointsGroup = screen.getByRole("group", { name: "Custom points" });
    expect(customPointsGroup).toHaveAttribute("aria-invalid", "true");
    expect(customPointsGroup.getAttribute("aria-describedby")).toContain("custom-points-error");
  });

  test("renders participant-facing summary lines and notices", () => {
    const config = {
      ...createDefaultScoringRuleConfig(),
      penaltyMode: "fixed_deduction" as const,
      deductionValue: 1,
      multiAttemptGradingMode: "average_score" as const,
    };

    render(
      <ScoringSummaryCard
        config={config}
        context="review"
        options={{ competitionType: "open", selectedProblemCount: 5 }}
      />,
    );

    expect(screen.getByText("How your score is computed")).toBeInTheDocument();
    expect(screen.getByText("Average score")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Penalties are applied with a zero floor, so final score never drops below zero.",
      ),
    ).toBeInTheDocument();
  });

  test("uses full-width select classes to avoid mobile overflow", () => {
    render(<ScoringContractWorkbench />);

    const selectLabels = [
      "Competition type",
      "Scoring mode",
      "Tie-breaker",
      "Wrong-answer penalty",
      "Open competition attempt policy",
    ] as const;

    for (const label of selectLabels) {
      const select = screen.getByLabelText(label);
      expect(select).toHaveClass("w-full");
      expect(select).toHaveClass("min-w-0");
    }
  });
});
