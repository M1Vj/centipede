import { render, screen } from "@testing-library/react";
import { AlertCircle, Inbox } from "lucide-react";
import { describe, expect, test } from "vitest";
import {
  EmptyState,
  ErrorState,
  FormStatusMessage,
  LoadingState,
} from "@/components/ui/feedback-states";

describe("feedback states", () => {
  test("renders a reusable loading state with accessible status semantics", () => {
    render(
      <LoadingState
        title="Loading registrations"
        description="Fetching the latest round data."
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Loading registrations");
    expect(screen.getByText("Fetching the latest round data.")).toBeInTheDocument();
  });

  test("renders empty and error states with optional actions", () => {
    render(
      <>
        <EmptyState
          icon={Inbox}
          title="No teams yet"
          description="Create the first team to begin registration."
          action={<button type="button">Create team</button>}
        />
        <ErrorState
          title="Could not load teams"
          description="Please try again."
          action={<button type="button">Retry</button>}
        />
      </>,
    );

    expect(screen.getByText("No teams yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create team" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load teams");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("renders success and error form messages with the correct live-region roles", () => {
    const { rerender } = render(
      <FormStatusMessage status="success" message="Profile saved." icon={Inbox} />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Profile saved.");

    rerender(
      <FormStatusMessage
        status="error"
        message="Unable to save profile."
        icon={AlertCircle}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to save profile.");
  });
});
