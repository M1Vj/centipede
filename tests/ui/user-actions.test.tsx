import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { UserActions, type AdminUserRecord } from "@/app/admin/users/user-actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

function buildUser(overrides: Partial<AdminUserRecord> = {}): AdminUserRecord {
  return {
    id: "0f0f7d7b-6c5b-42d3-b831-7a8998aaf19f",
    full_name: "Jane Doe",
    email: "jane@example.com",
    role: "mathlete",
    is_active: true,
    school: null,
    grade_level: null,
    organization: null,
    ...overrides,
  };
}

describe("UserActions", () => {
  test("renders delete flow as an alert dialog and requires DELETE confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);

    render(
      <UserActions
        user={buildUser()}
        onSuspend={vi.fn().mockResolvedValue(undefined)}
        onReactivate={vi.fn().mockResolvedValue(undefined)}
        onDelete={onDelete}
        onUpdate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Anonymize user account" }));

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Anonymize Jane Doe?");

    const deleteButton = screen.getByRole("button", { name: "Anonymize account" });
    expect(deleteButton).toBeDisabled();

    await user.type(screen.getByLabelText("Confirmation keyword"), "DELETE");
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("0f0f7d7b-6c5b-42d3-b831-7a8998aaf19f");
    });
  });

  test("renders edit flow as a dialog and saves updated details", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn().mockResolvedValue(undefined);

    render(
      <UserActions
        user={buildUser()}
        onSuspend={vi.fn().mockResolvedValue(undefined)}
        onReactivate={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onUpdate={onUpdate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit user details" }));

    expect(screen.getByRole("dialog", { name: "Jane Doe" })).toBeInTheDocument();

    const fullNameInput = screen.getByLabelText("Full name");
    await user.clear(fullNameInput);
    await user.type(fullNameInput, "Jane Admin");

    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        userId: "0f0f7d7b-6c5b-42d3-b831-7a8998aaf19f",
        fullName: "Jane Admin",
        role: "admin",
      });
    });
  });
});
