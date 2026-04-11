import { beforeEach, describe, expect, test, vi } from "vitest";
import OrganizerScoringPage from "@/app/organizer/scoring/page";
import { getWorkspaceContext } from "@/lib/auth/workspace";

vi.mock("@/lib/auth/workspace", () => ({
  getWorkspaceContext: vi.fn(),
}));

vi.mock("@/components/organizer/scoring-contract-workbench", () => ({
  ScoringContractWorkbench: () => null,
}));

describe("organizer scoring page guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("denies non-organizer access path when organizer guard rejects", async () => {
    vi.mocked(getWorkspaceContext).mockRejectedValueOnce(
      new Error("NEXT_REDIRECT:/mathlete"),
    );

    await expect(OrganizerScoringPage()).rejects.toThrow("NEXT_REDIRECT:/mathlete");
    expect(getWorkspaceContext).toHaveBeenCalledWith({ requireRole: "organizer" });
  });

  test("allows organizer access path when organizer guard passes", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValueOnce({
      userEmail: "organizer@example.com",
      profile: { role: "organizer" },
    } as never);

    await expect(OrganizerScoringPage()).resolves.toBeTruthy();
    expect(getWorkspaceContext).toHaveBeenCalledWith({ requireRole: "organizer" });
  });
});
