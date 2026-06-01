import { beforeEach, describe, expect, test, vi } from "vitest";
import { POST as publishLeaderboard } from "@/app/api/organizer/competitions/[competitionId]/leaderboard/publish/route";
import { POST as resolveDispute } from "@/app/api/organizer/competitions/[competitionId]/disputes/[disputeId]/resolve/route";
import { POST as queueExport } from "@/app/organizer/competition/[competitionId]/exports/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/notifications/dispatch", () => ({
  dispatchCompetitionNotification: vi.fn().mockResolvedValue(undefined),
}));

const COMPETITION_ID = "competition-1";
const ORGANIZER_ID = "organizer-1";
const DISPUTE_ID = "dispute-1";

type QueryResult = {
  data: unknown;
  error: unknown;
};

function chainQuery(result: QueryResult) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };

  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function makeCompetitionRow() {
  return {
    id: COMPETITION_ID,
    organizer_id: ORGANIZER_ID,
    name: "Leaderboard Cup",
    description: "",
    instructions: "",
    type: "scheduled",
    format: "individual",
    status: "ended",
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
  };
}

function makeOrganizerClient(userRpc = vi.fn()) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: { id: ORGANIZER_ID },
        },
      }),
    },
    rpc: userRpc,
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return chainQuery({
          data: {
            id: ORGANIZER_ID,
            role: "organizer",
            is_active: true,
          },
          error: null,
        });
      }

      if (table === "competitions") {
        return chainQuery({
          data: makeCompetitionRow(),
          error: null,
        });
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };
}

function makeAdminClient(rpc = vi.fn()) {
  return {
    rpc,
  };
}

function makePostRequest(path: string, body: Record<string, unknown> = {}) {
  return new Request(`http://localhost:3000${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost:3000",
      "x-forwarded-host": "localhost:3000",
      "content-type": "application/json",
      "x-idempotency-key": "idem-token-123",
    },
    body: JSON.stringify(body),
  });
}

describe("branch 14 organizer mutation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("publishes leaderboard through service-role RPC after actor authorization", async () => {
    const userRpc = vi.fn();
    const adminRpc = vi.fn().mockResolvedValue({
      data: [{
        machine_code: "ok",
        competition_id: COMPETITION_ID,
        leaderboard_published: true,
        event_id: "event-1",
        replayed: false,
        changed: true,
      }],
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue(makeOrganizerClient(userRpc) as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(adminRpc) as never);

    const response = await publishLeaderboard(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/leaderboard/publish`),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(userRpc).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("publish_leaderboard", {
      p_competition_id: COMPETITION_ID,
      p_request_idempotency_token: "idem-token-123",
      p_actor_user_id: ORGANIZER_ID,
    });
  });

  test("resolves accepted disputes through service-role RPC so recalculation can run", async () => {
    const userRpc = vi.fn();
    const adminRpc = vi.fn().mockResolvedValue({
      data: [{
        machine_code: "ok",
        dispute_id: DISPUTE_ID,
        competition_id: COMPETITION_ID,
        status: "accepted",
        correction_id: "correction-1",
        replayed: false,
        changed: true,
        resolved_at: "2026-05-01T00:00:00.000Z",
      }],
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue(makeOrganizerClient(userRpc) as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(adminRpc) as never);

    const response = await resolveDispute(
      makePostRequest(`/api/organizer/competitions/${COMPETITION_ID}/disputes/${DISPUTE_ID}/resolve`, {
        status: "accepted",
        resolutionNote: "Answer key corrected.",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID, disputeId: DISPUTE_ID }) },
    );

    expect(response.status).toBe(200);
    expect(userRpc).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("resolve_problem_dispute", {
      p_dispute_id: DISPUTE_ID,
      p_status: "accepted",
      p_resolution_note: "Answer key corrected.",
      p_request_idempotency_token: "idem-token-123",
      p_actor_user_id: ORGANIZER_ID,
    });
  });

  test("queues export jobs through service-role RPC after owner authorization", async () => {
    const userRpc = vi.fn();
    const adminRpc = vi.fn().mockResolvedValue({
      data: [{
        machine_code: "ok",
        export_job_id: "export-1",
        competition_id: COMPETITION_ID,
        requested_by: ORGANIZER_ID,
        format: "csv",
        scope: "leaderboard_history",
        status: "queued",
        replayed: false,
        changed: true,
        created_at: "2026-05-01T00:00:00.000Z",
      }],
      error: null,
    });

    vi.mocked(createClient).mockResolvedValue(makeOrganizerClient(userRpc) as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(adminRpc) as never);

    const response = await queueExport(
      makePostRequest(`/organizer/competition/${COMPETITION_ID}/exports`, {
        format: "csv",
        scope: "leaderboard_history",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );

    expect(response.status).toBe(200);
    expect(userRpc).not.toHaveBeenCalled();
    expect(adminRpc).toHaveBeenCalledWith("queue_export_job", {
      p_competition_id: COMPETITION_ID,
      p_format: "csv",
      p_scope: "leaderboard_history",
      p_request_idempotency_token: "idem-token-123",
      p_actor_user_id: ORGANIZER_ID,
    });
  });

  test("rejects unsupported export formats instead of silently queueing csv", async () => {
    const userRpc = vi.fn();
    const adminRpc = vi.fn();

    vi.mocked(createClient).mockResolvedValue(makeOrganizerClient(userRpc) as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(adminRpc) as never);

    const response = await queueExport(
      makePostRequest(`/organizer/competition/${COMPETITION_ID}/exports`, {
        format: "pdf",
        scope: "leaderboard_history",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_export_format");
    expect(adminRpc).not.toHaveBeenCalled();
  });

  test("rejects blank export scope instead of silently queueing default scope", async () => {
    const userRpc = vi.fn();
    const adminRpc = vi.fn();

    vi.mocked(createClient).mockResolvedValue(makeOrganizerClient(userRpc) as never);
    vi.mocked(createAdminClient).mockReturnValue(makeAdminClient(adminRpc) as never);

    const response = await queueExport(
      makePostRequest(`/organizer/competition/${COMPETITION_ID}/exports`, {
        format: "csv",
        scope: "",
      }),
      { params: Promise.resolve({ competitionId: COMPETITION_ID }) },
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("invalid_export_scope");
    expect(adminRpc).not.toHaveBeenCalled();
  });
});
