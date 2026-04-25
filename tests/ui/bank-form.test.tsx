import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { BankForm } from "@/components/problem-bank/bank-form";

const routerPushMock = vi.fn();
const routerRefreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    refresh: routerRefreshMock,
  }),
}));

describe("BankForm", () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    routerRefreshMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renders soft delete as a confirm dialog and deletes only after confirmation", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({}),
      }) as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <BankForm
        mode="edit"
        initialValue={{
          id: "bank-1",
          name: "Contest Bank",
          description: "Weekly bank",
          updatedAt: "2026-04-25T00:00:00.000Z",
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Soft delete" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Soft-delete bank?" });
    expect(dialog).toHaveTextContent("This bank will no longer be available in authoring flows.");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Soft delete" }));
    await user.click(await screen.findByRole("button", { name: "Soft delete" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/organizer/problem-banks/bank-1", {
        method: "DELETE",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedUpdatedAt: "2026-04-25T00:00:00.000Z" }),
      });
    });

    await waitFor(() => {
      expect(routerPushMock).toHaveBeenCalledWith("/organizer/problem-bank");
      expect(routerRefreshMock).toHaveBeenCalledTimes(1);
    });
  });
});
