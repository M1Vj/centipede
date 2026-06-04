import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const MIGRATION_PATH = join(process.cwd(), "supabase/migrations/20260421100000_11_arena_core.sql");
const PROFILE_FIX_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260422110000_11_restore_register_service_role_guard.sql",
);
const TEAM_LIFECYCLE_ACCESS_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260509103000_team_competition_lifecycle_access.sql",
);

describe("arena sql contracts", () => {
  test("team arena access allows active registered team members", () => {
    const sql = readFileSync(TEAM_LIFECYCLE_ACCESS_MIGRATION_PATH, "utf8");

    expect(sql).toContain("create or replace function public.can_actor_use_competition_registration(");
    expect(sql).toContain("create or replace function public.can_actor_use_competition_attempt(");
    expect(sql).toContain("create or replace function public.close_active_attempt_interval(");
    expect(sql).toContain("public.is_active_team_member(cr.team_id, p_actor_user_id)");
    expect(sql).toContain("public.can_actor_use_competition_attempt(p_attempt_id, v_caller_id)");
    expect(sql).not.toContain("team_leader_required");
  });

  test("team arena attempts are owned by each registered member", () => {
    const sql = readFileSync(TEAM_LIFECYCLE_ACCESS_MIGRATION_PATH, "utf8");

    expect(sql).toContain("add column if not exists participant_profile_id");
    expect(sql).toContain("competition_attempts_registration_participant_no_uq");
    expect(sql).toContain("and ca.participant_profile_id = v_caller_id");
    expect(sql).toContain("if not public.can_actor_use_competition_attempt(p_attempt_id, v_caller_id) then");
    expect(sql).toContain("participant_profile_id,");
    expect(sql).toContain("v_caller_id,");
  });

  test("team leaderboard scores sum official member attempts", () => {
    const sql = readFileSync(TEAM_LIFECYCLE_ACCESS_MIGRATION_PATH, "utf8");

    expect(sql).toContain("create or replace function public.refresh_leaderboard_entries");
    expect(sql).toContain("partition by ca.registration_id, ca.participant_profile_id");
    expect(sql).toContain("sum(coalesce(oma.final_score, 0)) as score");
    expect(sql).toContain("group by oma.competition_id, oma.registration_id");
  });

  test("scheduled team submissions grade without immediate leaderboard refresh dependency", () => {
    const sql = readFileSync(TEAM_LIFECYCLE_ACCESS_MIGRATION_PATH, "utf8");

    expect(sql).toContain("if v_competition.type = 'open'::public.competition_type");
    expect(sql).toContain("or coalesce(v_competition.leaderboard_published, false) then");
    expect(sql).toContain("perform public.refresh_leaderboard_entries(v_attempt.competition_id);");
  });

  test("active team registration roster lock also blocks inserts", () => {
    const sql = readFileSync(TEAM_LIFECYCLE_ACCESS_MIGRATION_PATH, "utf8");

    expect(sql).toContain("if tg_op = 'INSERT' then");
    expect(sql).toContain("before insert or update or delete on public.team_memberships");
  });

  test("actor-aware arena rpc execute privileges stay service-role only", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toContain("revoke all on function public.register_for_competition(uuid, uuid, uuid) from anon, authenticated;");
    expect(sql).toContain("revoke all on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) from anon, authenticated;");
    expect(sql).toContain("grant execute on function public.submit_competition_attempt(uuid, uuid, text, text) to service_role;");
  });

  test("register_for_competition uses canonical profile name field in forward fix", () => {
    const sql = readFileSync(PROFILE_FIX_MIGRATION_PATH, "utf8");

    expect(sql).toContain("if auth.role() <> 'service_role' then");
    expect(sql).toContain("v_profile.full_name");
    expect(sql).not.toContain("v_profile.display_name");
  });
});
