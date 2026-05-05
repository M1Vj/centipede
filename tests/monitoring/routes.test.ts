import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST as announce } from "@/app/api/organizer/competitions/[competitionId]/monitoring/announce/route";
import { POST as pause } from "@/app/api/organizer/competitions/[competitionId]/monitoring/pause/route";
import { POST as forcePause } from "@/app/api/admin/competitions/[competitionId]/monitoring/force-pause/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { dispatchCompetitionNotification } from "@/lib/notifications/dispatch";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchCompetitionNotification: vi.fn().mockResolvedValue({ ok: true }),
}));

const COMPETITION_ID = "competition-1";
const ORGANIZER_ID = "organizer-1";
const ADMIN_ID = "admin-1";

type QueryResult = {
  data: unknown;
  error: unknown;
};

function chainQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    neq: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.insert.mockReturnValue(query);
  return query;
}

function makeCompetitionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Monitoring Cup",
    description: "",
    instructions: "",
    type: "open",
    format: "individual",
    status: "live",
    answer_key_visibility: "after_end",
    registration_start: null,
    registration_end: null,
    start_time: null,
    end_time: null,
    duration_minutes: 60,
    attempts_allowed: 1,
    multi_attempt_grading_mode: "highest_score",
    max_participants: 30,
    participants_per_team: null,
    max_teams: null,
    scoring_mode: "difficulty",
    custom_points_by_problem_id: {},
    penalty_mode: "none",
    deduction_value: 0,
    tie_breaker: "earliest_final_submission",
    shuffle_questions: false,
    shuffle_options: false,
    log_tab_switch: false,
    offense_penalties_json: [],
    safe_exam_browser_mode: "off",
    safe_exam_browser_config_key_hashes: [],
    scoring_snapshot_json: null,
    draft_revision: 1,
    draft_version: 1,
    is_deleted: false,
    leaderboard_published: false,
    published_at: null,
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeActorClient(actorId: string, role: "organizer" | "admin", competitionOverrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: actorId },
        },
      }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return chainQuery({
          data: {
            id: actorId,
            role,
            is_active: true,
          },
          error: null,
        });
      }

      if (table === "competitions") {
        return chainQuery({
          data: makeCompetitionRow(competitionOverrides),
          error: null,
        });
      }

      throw new Error(`Unexpected user table: ${table}`);
    }),
  };
}

function makeAdminClient(rpc = vi.fn(), options: {
  registrations?: Array<Record<string, unknown>>;
  teamMemberships?: Array<Record<string, unknown>>;
} = {}) {
  const announcementInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: "announcement-1",
          competition_id: COMPETITION_ID,
          audience: "registered_only",
          title: "Schedule update",
          body: "Pause starts at noon.",
        },
        error: null,
      }),
    }),
  });

  return {
    rpc,
    from: vi.fn((table: string) => {
      if (table === "competition_announcements") {
        return {
          insert: announcementInsert,
        };
      }

      if (table === "competition_registrations") {
        const registrationData = options.registrations ?? [
          { id: "registration-1", profile_id: "mathlete-1", status: "registered" },
          { id: "registration-2", profile_id: "mathlete-2", status: "withdrawn" },
        ];
        const query = chainQuery({
          data: registrationData,
          error: null,
        });
        query.in.mockImplementation((_column: string, statuses: string[]) => Promise.resolve({
          data: registrationData.filter((registration) => statuses.includes(String(registration.status))),
          error: null,
        }));
        return query;
      }

      if (table === "team_memberships") {
        const query = chainQuery({
          data: options.teamMemberships ?? [],
          error: null,
        });
        query.in.mockImplementation((_column: string, teamIds: string[]) => Promise.resolve({
          data: (options.teamMemberships ?? []).filter((membership) => teamIds.includes(String(membership.team_id))),
          error: null,
        }));
        return query;
      }

      throw new Error(`Unexpected admin table: ${table}`);
    }),
  };
}

function makePostRequest(path: string, body: Record<string, unknown> = {}, token = "idem-token-123") {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "application/json",
      ...(token ? { "x-idempotency-key": token } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("participant monitoring routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("organizer announcement writes durable row before dispatching eligible recipients", async () => {
    const admin = makeAdminClient();
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ORGANIZER_ID, "organizer") as never);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const response = (await announce(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/announce`, {
        title: "Schedule update",
        body: "Pause starts at noon.",
        audience: "registered_only",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;

    expect(response.status).toBe(200);
    expect(admin.from).toHaveBeenNthCalledWith(1, "competition_announcements");
    expect(dispatchCompetitionNotification).toHaveBeenCalledTimes(1);
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(expect.objectContaining({
      event: "competition_announcement_posted",
      eventIdentityKey: "announcement:announcement-1:registration-1:mathlete-1",
      recipientId: "mathlete-1",
      actorId: ORGANIZER_ID,
      competitionId: COMPETITION_ID,
      registrationId: "registration-1",
    }));
  });

  test("organizer announcement fans out team registrations to active team members", async () => {
    const admin = makeAdminClient(vi.fn(), {
      registrations: [
        { id: "registration-team-1", profile_id: null, team_id: "team-1", status: "registered" },
      ],
      teamMemberships: [
        { team_id: "team-1", profile_id: "mathlete-1", is_active: true },
        { team_id: "team-1", profile_id: "mathlete-2", is_active: true },
      ],
    });
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ORGANIZER_ID, "organizer") as never);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const response = (await announce(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/announce`, {
        title: "Schedule update",
        body: "Pause starts at noon.",
        audience: "registered_only",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.dispatchCount).toBe(2);
    expect(dispatchCompetitionNotification).toHaveBeenCalledTimes(2);
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(expect.objectContaining({
      eventIdentityKey: "announcement:announcement-1:registration-team-1:mathlete-1",
      recipientId: "mathlete-1",
      registrationId: "registration-team-1",
    }));
    expect(dispatchCompetitionNotification).toHaveBeenCalledWith(expect.objectContaining({
      eventIdentityKey: "announcement:announcement-1:registration-team-1:mathlete-2",
      recipientId: "mathlete-2",
      registrationId: "registration-team-1",
    }));
  });

  test("organizer announcement surfaces dispatch failures as non-ok result", async () => {
    const admin = makeAdminClient();
    vi.mocked(dispatchCompetitionNotification).mockResolvedValueOnce({
      ok: false,
      eventIdentityKey: "announcement:announcement-1:mathlete-1",
      error: "enqueue_failed",
    });
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ORGANIZER_ID, "organizer") as never);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const response = (await announce(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/announce`, {
        title: "Schedule update",
        body: "Pause starts at noon.",
        audience: "registered_only",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.code).toBe("announcement_failed");
  });

  test("organizer announcement rejects soft-deleted competitions before durable writes", async () => {
    const admin = makeAdminClient();
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ORGANIZER_ID, "organizer", { is_deleted: true }) as never);
    vi.mocked(createAdminClient).mockReturnValue(admin as never);

    const response = (await announce(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/announce`, {
        title: "Schedule update",
        body: "Pause starts at noon.",
        audience: "registered_only",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe("deleted");
    expect(admin.from).not.toHaveBeenCalled();
    expect(dispatchCompetitionNotification).not.toHaveBeenCalled();
  });

  test("organizer pause calls service-role RPC with owner actor and canonical tuple", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        machine_code: "ok",
        competition_id: COMPETITION_ID,
        status: "paused",
        event_id: "event-1",
        replayed: false,
        changed: true,
        request_idempotency_token: "idem-token-123",
      }],
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ORGANIZER_ID, "organizer") as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(rpc) as never);

    const response = (await pause(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/pause`, {
        reason: "Proctor incident.",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("pause_competition", {
      p_competition_id: COMPETITION_ID,
      p_reason: "Proctor incident.",
      p_request_idempotency_token: "idem-token-123",
      p_actor_user_id: ORGANIZER_ID,
      p_actor_role: "organizer",
    });
  });

  test("admin force-pause calls service-role RPC with admin actor and no organizer-only endpoints", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{
        machine_code: "ok",
        competition_id: COMPETITION_ID,
        status: "paused",
        event_id: "event-1",
        replayed: false,
        changed: true,
        request_idempotency_token: "admin-token-1",
      }],
      error: null,
    });
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ADMIN_ID, "admin") as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(rpc) as never);

    const response = (await forcePause(
      makePostRequest(`/api/admin/competitions/${COMPETITION_ID}/monitoring/force-pause`, {
        reason: "Platform incident.",
      }, "admin-token-1"),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("pause_competition", {
      p_competition_id: COMPETITION_ID,
      p_reason: "Platform incident.",
      p_request_idempotency_token: "admin-token-1",
      p_actor_user_id: ADMIN_ID,
      p_actor_role: "admin",
    });
  });

  test("monitoring control routes reject missing reason or token before RPC", async () => {
    const rpc = vi.fn();
    vi.mocked(createClient).mockResolvedValue(makeActorClient(ORGANIZER_ID, "organizer") as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(rpc) as never);

    const missingReason = (await pause(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/pause`, {
        reason: " ",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;
    const missingToken = (await pause(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/monitoring/pause`, {
        reason: "Proctor incident.",
      }, ""),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    ))!;

    expect(missingReason.status).toBe(400);
    expect(missingToken.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
