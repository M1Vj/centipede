import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";

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

function renderWizard() {
  return render(
    <CompetitionWizard
      mode="create"
      initialState={createDefaultCompetitionDraftState()}
      availableProblems={[]}
    />,
  );
}

describe("CompetitionWizard schedule behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("computes competition end from start plus duration and keeps it read-only", () => {
    renderWizard();

    const startInput = screen.getByLabelText("Competition start");
    const durationInput = screen.getByLabelText("Duration minutes");
    const endInput = screen.getByLabelText("Competition end") as HTMLInputElement;

    fireEvent.change(startInput, { target: { value: "2026-04-05T09:00" } });
    fireEvent.change(durationInput, { target: { value: "90" } });

    expect(endInput.value).toBe("2026-04-05T10:30");
    expect(endInput).toHaveAttribute("readonly");
  });

  test("toggles between default and manual registration timing", () => {
    renderWizard();

    const modeSelect = screen.getByLabelText("Registration timing");
    const registrationStart = screen.getByLabelText("Registration start");
    const registrationEnd = screen.getByLabelText("Registration end");

    expect(modeSelect).toHaveValue("default");
    expect(registrationStart).toBeDisabled();
    expect(registrationEnd).toBeDisabled();

    fireEvent.change(modeSelect, { target: { value: "manual" } });

    expect(modeSelect).toHaveValue("manual");
    expect(registrationStart).toBeEnabled();
    expect(registrationEnd).toBeEnabled();
  });

  test("keeps max participants input editable when clearing value", () => {
    renderWizard();

    const maxParticipantsInput = screen.getByLabelText("Max participants") as HTMLInputElement;

    fireEvent.change(maxParticipantsInput, { target: { value: "42" } });
    expect(maxParticipantsInput.value).toBe("42");

    fireEvent.change(maxParticipantsInput, { target: { value: "" } });
    expect(maxParticipantsInput.value).toBe("");
  });
});
