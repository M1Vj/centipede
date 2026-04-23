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

function openScheduleStep() {
  fireEvent.click(screen.getByRole("button", { name: /Continue to Schedule/i }));
}

describe("CompetitionWizard schedule behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("computes competition end from start plus duration and keeps it read-only", () => {
    renderWizard();
    openScheduleStep();

    const startDateInput = screen.getByLabelText("Competition start") as HTMLInputElement;
    const startTimeInput = screen.getByLabelText("Competition start time") as HTMLInputElement;
    const durationInput = screen.getByLabelText(/Duration/i);
    const endDateInput = screen.getByLabelText("Competition end") as HTMLInputElement;
    const endTimeInput = screen.getByLabelText("Competition end time") as HTMLInputElement;

    fireEvent.change(startDateInput, { target: { value: "2026-04-05" } });
    fireEvent.change(startTimeInput, { target: { value: "09:00" } });
    fireEvent.change(durationInput, { target: { value: "90" } });

    expect(startDateInput).toHaveAttribute("type", "date");
    expect(startTimeInput).toHaveAttribute("type", "time");
    expect(endDateInput.value).toBe("2026-04-05");
    expect(endTimeInput.value).toBe("10:30");
    expect(endDateInput).toHaveAttribute("readonly");
    expect(endTimeInput).toHaveAttribute("readonly");
  });

  test("toggles between default and manual registration timing", () => {
    renderWizard();
    openScheduleStep();

    const modeSelect = screen.getByLabelText("Registration timing");
    const registrationStart = screen.getByLabelText("Registration start");
    const registrationStartTime = screen.getByLabelText("Registration start time");
    const registrationEnd = screen.getByLabelText("Registration end");
    const registrationEndTime = screen.getByLabelText("Registration end time");

    expect(modeSelect).toHaveValue("default");
    expect(registrationStart).toBeDisabled();
    expect(registrationStartTime).toBeDisabled();
    expect(registrationEnd).toBeDisabled();
    expect(registrationEndTime).toBeDisabled();

    fireEvent.change(modeSelect, { target: { value: "manual" } });

    expect(modeSelect).toHaveValue("manual");
    expect(registrationStart).toBeEnabled();
    expect(registrationStartTime).toBeEnabled();
    expect(registrationEnd).toBeEnabled();
    expect(registrationEndTime).toBeEnabled();
  });

  test("keeps max participants input editable when clearing value", () => {
    renderWizard();
    openScheduleStep();

    const maxParticipantsInput = screen.getByLabelText("Max participants") as HTMLInputElement;

    fireEvent.change(maxParticipantsInput, { target: { value: "42" } });
    expect(maxParticipantsInput.value).toBe("42");

    fireEvent.change(maxParticipantsInput, { target: { value: "" } });
    expect(maxParticipantsInput.value).toBe("");
  });

  test("opens native pickers from the date and time icon buttons", () => {
    renderWizard();
    openScheduleStep();

    const startDateInput = screen.getByLabelText("Competition start") as HTMLInputElement;
    const startTimeInput = screen.getByLabelText("Competition start time") as HTMLInputElement;
    const startDateShowPicker = vi.fn();
    const startTimeShowPicker = vi.fn();

    Object.defineProperty(startDateInput, "showPicker", {
      configurable: true,
      value: startDateShowPicker,
    });
    Object.defineProperty(startTimeInput, "showPicker", {
      configurable: true,
      value: startTimeShowPicker,
    });

    fireEvent.click(screen.getByRole("button", { name: "Open Competition start date picker" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Competition start time picker" }));

    expect(startDateShowPicker).toHaveBeenCalledTimes(1);
    expect(startTimeShowPicker).toHaveBeenCalledTimes(1);
  });
});
