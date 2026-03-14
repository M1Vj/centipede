import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

describe("ConfirmDialog", () => {
  test("renders an accessible confirmation surface with pending action feedback", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={vi.fn()}
        title="Sign out now?"
        description="You will need to authenticate again to return to protected areas."
        confirmLabel="Sign out"
        pending
        pendingLabel="Signing out..."
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Sign out now?");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();
  });
});
