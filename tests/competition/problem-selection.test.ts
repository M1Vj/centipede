import { describe, expect, test, vi } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: vi.fn((body: unknown, init?: { status?: number }) => {
      return new Response(JSON.stringify(body), {
        status: init?.status ?? 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { validateCompetitionProblemSelection } from "@/app/api/organizer/competitions/_shared";

function createProblemSelectionClient(availableIds: string[]) {
  const eq = vi.fn().mockResolvedValue({
    data: availableIds.map((id) => ({ id })),
    error: null,
  });
  const inQuery = vi.fn().mockReturnValue({ eq });
  const select = vi.fn().mockReturnValue({ in: inQuery });
  const from = vi.fn().mockReturnValue({ select });

  return {
    from,
    select,
    inQuery,
    eq,
  };
}

describe("validateCompetitionProblemSelection", () => {
  test("returns missing ids when selection includes inaccessible problems", async () => {
    const supabase = createProblemSelectionClient(["problem-1", "problem-3"]);

    const result = await validateCompetitionProblemSelection(supabase as never, [
      "problem-1",
      "problem-2",
      "problem-3",
    ]);

    expect(result.selectedProblemIds).toEqual(["problem-1", "problem-2", "problem-3"]);
    expect(result.missingProblemIds).toEqual(["problem-2"]);
    expect(supabase.from).toHaveBeenCalledWith("problems");
  });

  test("returns empty missing ids when every selected problem is accessible", async () => {
    const supabase = createProblemSelectionClient(["problem-1", "problem-2"]);

    const result = await validateCompetitionProblemSelection(supabase as never, ["problem-1", "problem-2"]);

    expect(result.selectedProblemIds).toEqual(["problem-1", "problem-2"]);
    expect(result.missingProblemIds).toEqual([]);
  });
});
