import { beforeEach, describe, expect, test, vi } from "vitest";
import OrganizerScoringPage from "@/app/organizer/scoring/page";
import { getWorkspaceContext } from "@/lib/auth/workspace";

vi.mock("@/lib/auth/workspace", () => ({
  getWorkspaceContext: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
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

  test("redirects organizers into competition wizard create flow", async () => {
    vi.mocked(getWorkspaceContext).mockResolvedValueOnce({
      userEmail: "organizer@example.com",
      profile: { role: "organizer" },
    } as never);

    await expect(OrganizerScoringPage()).rejects.toThrow("NEXT_REDIRECT:/organizer/competition/create");
    expect(getWorkspaceContext).toHaveBeenCalledWith({ requireRole: "organizer" });
  });
});
