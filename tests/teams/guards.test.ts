import { describe, expect, test, vi } from "vitest";
import { getTeamRosterLock, hasTeamRegistrationConflict } from "@/lib/teams/guards";

type QueryResult = {
  data: unknown;
  error: { code?: string | null; message?: string | null } | null;
};

type QueryChain = {
  data: unknown;
  error: { code?: string | null; message?: string | null } | null;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function createQueryChain(result: QueryResult): QueryChain {
  const chain = {
    data: result.data,
    error: result.error,
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  };

  return chain;
}

function createAdminMock({
  competitionRegistrationResponses,
  memberTeamsResponse,
}: {
  competitionRegistrationResponses: QueryResult[];
  memberTeamsResponse?: QueryResult;
}) {
  let competitionCall = 0;
  const competitionChains = competitionRegistrationResponses.map(createQueryChain);
  const memberTeamsChain = createQueryChain(
    memberTeamsResponse ?? { data: [], error: null },
  );

  const admin = {
    from: vi.fn((table: string) => {
      if (table === "competition_registrations") {
        const chain = competitionChains[competitionCall] ??
          createQueryChain({ data: [], error: null });
        competitionCall += 1;
        return chain;
      }

      if (table === "team_memberships") {
        return memberTeamsChain;
      }

      return createQueryChain({ data: [], error: null });
    }),
  };

  return { admin, competitionChains, memberTeamsChain };
}

describe("team guard helpers", () => {
  test("getTeamRosterLock returns unlocked when schema is missing", async () => {
    const { admin } = createAdminMock({
      competitionRegistrationResponses: [
        {
          data: null,
          error: {
            code: "42P01",
            message: "relation competition_registrations does not exist",
          },
        },
      ],
    });

    const result = await getTeamRosterLock(admin as never, "team-1");

    expect(result).toEqual({ locked: false, competitionId: null });
    expect(admin.from).toHaveBeenCalledWith("competition_registrations");
  });

  test("hasTeamRegistrationConflict returns no conflict when schema is missing", async () => {
    const { admin } = createAdminMock({
      competitionRegistrationResponses: [
        {
          data: null,
          error: {
            code: "42703",
            message: "column competition_id does not exist",
          },
        },
      ],
    });

    const result = await hasTeamRegistrationConflict(
      admin as never,
      "team-1",
      "profile-1",
    );

    expect(result).toEqual({ conflict: false, competitionId: null });
  });

  test("hasTeamRegistrationConflict tolerates missing schema in conflict lookup", async () => {
    const { admin } = createAdminMock({
      competitionRegistrationResponses: [
        {
          data: [
            {
              competition_id: "comp-1",
              competitions: { status: "active", format: "team", type: "scheduled" },
            },
          ],
          error: null,
        },
        {
          data: null,
          error: {
            code: "42P01",
            message: "relation competition_registrations does not exist",
          },
        },
      ],
      memberTeamsResponse: {
        data: [{ team_id: "team-2" }],
        error: null,
      },
    });

    const result = await hasTeamRegistrationConflict(
      admin as never,
      "team-1",
      "profile-1",
    );

    expect(result).toEqual({ conflict: false, competitionId: null });
  });
});
