import { beforeEach, describe, expect, test, vi } from "vitest";
import { loadArenaPageData } from "@/lib/arena/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const competitionRow = {
  id: "competition-1",
  organizer_id: "organizer-1",
  name: "Arena",
  description: "",
  instructions: "",
  type: "scheduled",
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
  max_participants: null,
  participants_per_team: null,
  max_teams: null,
  scoring_mode: "difficulty",
  custom_points: {},
  penalty_mode: "none",
  deduction_value: 0,
  tie_breaker: "earliest_final_submission",
  shuffle_questions: false,
  shuffle_options: false,
  log_tab_switch: true,
  offense_penalties: [],
  scoring_snapshot_json: null,
  draft_revision: 1,
  draft_version: 1,
  is_deleted: false,
  published: true,
  is_paused: false,
  published_at: null,
  created_at: "2026-05-02T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z",
};

function resolvedQuery(data: unknown) {
  return {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    in() {
      return this;
    },
    order() {
      return Promise.resolve({ data, error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data, error: null });
    },
    then(resolve: (value: { data: unknown; error: null }) => void) {
      return Promise.resolve({ data, error: null }).then(resolve);
    },
  };
}

describe("arena page data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "competitions") {
          return resolvedQuery(competitionRow);
        }

        return resolvedQuery([]);
      }),
    } as never);
  });

  test("carries competition tab-switch logging flag into arena payload", async () => {
    const data = await loadArenaPageData("competition-1", "mathlete-1");

    expect(data?.competition.logTabSwitch).toBe(true);
  });
});
