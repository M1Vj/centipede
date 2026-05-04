import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  listMyRegistrationDetails,
  listOrganizerCompetitionRegistrations,
} from "@/lib/registrations/api";
import { normalizeOrganizerRegistrationRow } from "@/lib/registrations/organizer";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

type QueryResult = {
  data: unknown[] | null;
  error: { code?: string; message: string } | null;
};

function createQueryMock(result: QueryResult) {
  const query = {
    select: vi.fn(() => query),
    order: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
  };

  return query;
}

function createSupabaseMock(input: {
  userId?: string | null;
  registrations?: QueryResult | QueryResult[];
  competitions?: QueryResult | QueryResult[];
}) {
  const registrationResults = Array.isArray(input.registrations)
    ? input.registrations
    : [
        input.registrations ?? {
          data: [],
          error: null,
        },
      ];
  const competitionResults = Array.isArray(input.competitions)
    ? input.competitions
    : [
        input.competitions ?? {
          data: [],
          error: null,
        },
      ];
  const registrationQueries = registrationResults.map((result) => createQueryMock(result));
  const competitionQueries = competitionResults.map((result) => createQueryMock(result));
  let registrationQueryIndex = 0;
  let competitionQueryIndex = 0;
  const registrationQuery = registrationQueries[0];
  const competitionQuery = competitionQueries[0];
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: input.userId === null ? null : { id: input.userId ?? "mathlete-1" },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "competition_registrations") {
        return registrationQueries[Math.min(registrationQueryIndex++, registrationQueries.length - 1)];
      }

      if (table === "competitions") {
        return competitionQueries[Math.min(competitionQueryIndex++, competitionQueries.length - 1)];
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, registrationQuery, competitionQuery };
}

describe("registration api helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("listMyRegistrationDetails returns current user's registration competition details", async () => {
    const { client, registrationQuery, competitionQuery } = createSupabaseMock({
      registrations: {
        data: [
          {
            id: "registration-1",
            competition_id: "competition-1",
            team_id: null,
            status: "registered",
            status_reason: null,
            registered_at: "2026-04-25T01:00:00.000Z",
            updated_at: "2026-04-25T01:00:00.000Z",
          },
        ],
        error: null,
      },
      competitions: {
        data: [
          {
            id: "competition-1",
            organizer_id: "organizer-1",
            name: "Spring Invitational",
            description: "",
            instructions: "",
            type: "scheduled",
            format: "individual",
            status: "published",
            registration_start: "2026-04-24T00:00:00.000Z",
            registration_end: "2026-04-26T00:00:00.000Z",
            start_time: "2026-04-27T00:00:00.000Z",
            end_time: null,
            duration_minutes: 60,
            attempts_allowed: 1,
            max_participants: 100,
            participants_per_team: null,
            max_teams: null,
            created_at: "2026-04-20T00:00:00.000Z",
            updated_at: "2026-04-20T00:00:00.000Z",
          },
        ],
        error: null,
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    const details = await listMyRegistrationDetails({
      statuses: ["registered"],
      limit: 25,
    });

    expect(registrationQuery.in).toHaveBeenCalledWith("status", ["registered"]);
    expect(registrationQuery.limit).toHaveBeenCalledWith(25);
    expect(competitionQuery.in).toHaveBeenCalledWith("id", ["competition-1"]);
    expect(details).toEqual([
      {
        id: "registration-1",
        competition_id: "competition-1",
        team_id: null,
        status: "registered",
        status_reason: null,
        registered_at: "2026-04-25T01:00:00.000Z",
        updated_at: "2026-04-25T01:00:00.000Z",
        competition: {
          id: "competition-1",
          name: "Spring Invitational",
          type: "scheduled",
          format: "individual",
          status: "published",
          startTime: "2026-04-27T00:00:00.000Z",
          endTime: null,
          registrationStart: "2026-04-24T00:00:00.000Z",
        },
      },
    ]);
  });

  test("listMyRegistrationDetails tolerates deferred registration schema", async () => {
    const { client, competitionQuery } = createSupabaseMock({
      registrations: {
        data: null,
        error: { code: "42P01", message: "relation competition_registrations does not exist" },
      },
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(listMyRegistrationDetails()).resolves.toEqual([]);
    expect(competitionQuery.select).not.toHaveBeenCalled();
  });

  test("listMyRegistrationDetails requires authentication", async () => {
    const { client } = createSupabaseMock({ userId: null });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(listMyRegistrationDetails()).rejects.toThrow("Unauthorized");
  });

  test("listOrganizerCompetitionRegistrations falls back to snapshot rows when embeds are unavailable", async () => {
    const { client } = createSupabaseMock({
      registrations: [
        {
          data: null,
          error: {
            code: "PGRST200",
            message: "Could not find a relationship between competition_registrations and profiles",
          },
        },
        {
          data: [
            {
              id: "registration-1",
              competition_id: "competition-1",
              profile_id: "profile-1",
              team_id: null,
              status: "registered",
              status_reason: null,
              entry_snapshot_json: {
                full_name: "Snapshot Name",
                school: "Snapshot School",
                grade_level: "Grade 8",
              },
              registered_at: "2026-04-25T01:00:00.000Z",
              updated_at: "2026-04-25T01:00:00.000Z",
            },
          ],
          error: null,
        },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(client as never);

    await expect(
      listOrganizerCompetitionRegistrations({ competitionId: "competition-1" }),
    ).resolves.toMatchObject([
      {
        id: "registration-1",
        displayName: "Snapshot Name",
        subtitle: "Snapshot School / Grade 8",
      },
    ]);
    expect(client.from).toHaveBeenCalledTimes(2);
  });

  test("normalizeOrganizerRegistrationRow builds individual participant details from profile and snapshot fallback", () => {
    expect(
      normalizeOrganizerRegistrationRow({
        id: "registration-1",
        competition_id: "competition-1",
        profile_id: "profile-1",
        team_id: null,
        status: "registered",
        status_reason: null,
        entry_snapshot_json: {
          full_name: "Snapshot Name",
          school: "Snapshot School",
          grade_level: "Grade 8",
        },
        registered_at: "2026-04-25T01:00:00.000Z",
        updated_at: "2026-04-25T01:00:00.000Z",
        profiles: {
          id: "profile-1",
          full_name: "Ada Lovelace",
          school: "Centipede High",
          grade_level: "Grade 9",
        },
      }),
    ).toEqual({
      id: "registration-1",
      competitionId: "competition-1",
      profileId: "profile-1",
      teamId: null,
      participantType: "individual",
      displayName: "Ada Lovelace",
      subtitle: "Centipede High / Grade 9",
      status: "registered",
      statusReason: null,
      registeredAt: "2026-04-25T01:00:00.000Z",
      updatedAt: "2026-04-25T01:00:00.000Z",
      roster: [],
    });
  });

  test("normalizeOrganizerRegistrationRow builds team participant details with roster snapshot", () => {
    expect(
      normalizeOrganizerRegistrationRow({
        id: "registration-2",
        competition_id: "competition-1",
        profile_id: null,
        team_id: "team-1",
        status: "ineligible",
        status_reason: "team_roster_incomplete",
        entry_snapshot_json: {
          team_name: "Fallback Team",
          team_code: "ABC123",
          roster: [
            {
              profile_id: "member-1",
              full_name: "Grace Hopper",
              school: "Centipede High",
              grade_level: "Grade 10",
              role: "leader",
            },
          ],
        },
        registered_at: "2026-04-25T02:00:00.000Z",
        updated_at: "2026-04-25T02:10:00.000Z",
        teams: {
          id: "team-1",
          name: "Team Integral",
          team_code: "TEAM42",
        },
      }),
    ).toEqual({
      id: "registration-2",
      competitionId: "competition-1",
      profileId: null,
      teamId: "team-1",
      participantType: "team",
      displayName: "Team Integral",
      subtitle: "ABC123 / 1 member",
      status: "ineligible",
      statusReason: "team_roster_incomplete",
      registeredAt: "2026-04-25T02:00:00.000Z",
      updatedAt: "2026-04-25T02:10:00.000Z",
      roster: [
        {
          profileId: "member-1",
          fullName: "Grace Hopper",
          school: "Centipede High",
          gradeLevel: "Grade 10",
          role: "leader",
        },
      ],
    });
  });
});
