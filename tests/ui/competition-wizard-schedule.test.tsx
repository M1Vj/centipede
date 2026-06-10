import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { CompetitionWizard } from "@/components/competition-wizard/competition-wizard";
import { createDefaultCompetitionDraftState } from "@/lib/competition/validation";

const routerSpies = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
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

  test("renders the draft flow as one wizard phase at a time", () => {
    renderWizard();

    expect(screen.getAllByText("Competition Overview").length).toBeGreaterThan(0);
    expect(screen.queryByText("Schedule & Timing")).not.toBeInTheDocument();
    expect(screen.queryByText("Available problems")).not.toBeInTheDocument();
    expect(screen.queryByText("Competition Scoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Problem bank preview")).not.toBeInTheDocument();

    openScheduleStep();

    expect(screen.queryByText("Competition Overview")).not.toBeInTheDocument();
    expect(screen.getByText("Schedule & Timing")).toBeInTheDocument();
    expect(screen.getByText("Competition Format")).toBeInTheDocument();
    expect(screen.queryByText("Available problems")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Continue to Problems/i }));

    expect(screen.queryByText("Schedule & Timing")).not.toBeInTheDocument();
    expect(screen.queryByText("Competition Format")).not.toBeInTheDocument();
    expect(screen.getByText("Available problems")).toBeInTheDocument();
  });

  test("labels the phase indicator as current position instead of completion percent", () => {
    renderWizard();

    expect(screen.getByText("Phase 1/5")).toBeInTheDocument();
    expect(screen.getByText("Current step")).toBeInTheDocument();
    expect(screen.queryByText("Step 1 of 5")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed")).not.toBeInTheDocument();
    expect(screen.queryByText("20%")).not.toBeInTheDocument();

    openScheduleStep();

    expect(screen.getByText("Phase 2/5")).toBeInTheDocument();
    expect(screen.queryByText("40%")).not.toBeInTheDocument();
  });

  test("scrolls to the wizard top when continuing between phases", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });

    renderWizard();

    fireEvent.click(screen.getByRole("button", { name: /Continue to Schedule/i }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    fireEvent.click(screen.getByRole("button", { name: /Continue to Problems/i }));

    expect(scrollIntoView).toHaveBeenCalledTimes(2);
  });

  test("places create draft in the final navigation row", () => {
    renderWizard();

    expect(screen.queryByRole("button", { name: "Create draft" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Review" }));

    const navigation = screen.getByLabelText("Wizard navigation");
    expect(within(navigation).getByRole("button", { name: "Scoring" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Create draft" })).toBeInTheDocument();
  });

  test("replaces the create route with the new draft detail after creating a draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            competition: {
              id: "new-draft-competition",
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );

    render(
      <CompetitionWizard
        mode="create"
        initialState={{
          ...createDefaultCompetitionDraftState(),
          name: "Fresh Draft",
          description: "A new draft from the dashboard.",
          instructions: "Solve each problem carefully.",
          type: "open",
        }}
        availableProblems={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await screen.findByText("Creating draft...");

    await waitFor(() => {
      expect(routerSpies.replace).toHaveBeenCalledWith("/organizer/competition/new-draft-competition");
    });
    expect(routerSpies.push).not.toHaveBeenCalledWith("/organizer/competition/new-draft-competition");
  });

  test("clears create form state before leaving for the created draft detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            competition: {
              id: "new-draft-competition",
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

    fireEvent.change(screen.getByLabelText("Competition name"), {
      target: { value: "Cached draft name" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Cached draft description." },
    });
    fireEvent.change(screen.getByLabelText("Rules and instructions"), {
      target: { value: "Cached draft instructions." },
    });

    fireEvent.click(screen.getByRole("button", { name: /Continue to Schedule/i }));
    fireEvent.change(screen.getByLabelText("Competition type"), {
      target: { value: "open" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => {
      expect(routerSpies.replace).toHaveBeenCalledWith("/organizer/competition/new-draft-competition");
    });

    fireEvent.click(screen.getByRole("button", { name: "Overview" }));

    expect(screen.getByLabelText("Competition name")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
    expect(screen.getByLabelText("Rules and instructions")).toHaveValue("");
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
