import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  test("shows a pending label, spinner, and disabled state while work is in flight", () => {
    render(
      <Button pending pendingText="Saving profile">
        Save profile
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Saving profile" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByTestId("button-spinner")).toBeInTheDocument();
    expect(screen.queryByText("Save profile")).not.toBeInTheDocument();
  });

  test("keeps the original label and enabled state when not pending", () => {
    render(<Button>Save profile</Button>);

    const button = screen.getByRole("button", { name: "Save profile" });

    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
    expect(screen.queryByTestId("button-spinner")).not.toBeInTheDocument();
  });
});
