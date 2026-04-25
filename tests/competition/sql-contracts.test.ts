import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const FORWARD_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425065500_12_fix_authenticated_registration_ambiguity.sql",
);
const DEFAULT_REGISTRATION_WINDOW_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425080000_fix_default_registration_window.sql",
);
const VALIDATE_TEAM_REGISTRATION_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425180500_fix_team_registration_team_id_ambiguity.sql",
);
const TEAM_REGISTRATION_RLS_HARDENING_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425190000_harden_team_registration_rls_qualification.sql",
);
const TEAM_REGISTRATION_VERIFY_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425184500_verify_team_registration_ambiguity_fix.sql",
);
const LIFECYCLE_FORWARD_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425061000_12_fix_registration_and_lifecycle_ambiguity.sql",
);
const START_COMPETITION_EFFECTIVE_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260422105000_08_fix_start_competition_status_return.sql",
);

describe("competition sql contracts", () => {
  test("start_competition qualifies event lookup columns to avoid output-parameter ambiguity", () => {
    const sql = readFileSync(START_COMPETITION_EFFECTIVE_MIGRATION_PATH, "utf8");

    expect(sql).toContain("from public.competition_events ce");
    expect(sql).toContain("where ce.competition_id = p_competition_id");
    expect(sql).toContain("and ce.request_idempotency_token = v_token");
  });

  test("start_competition returns qualified competition status", () => {
    const sql = readFileSync(START_COMPETITION_EFFECTIVE_MIGRATION_PATH, "utf8");

    expect(sql).toContain("update public.competitions as c");
    expect(sql).toContain("returning c.status");
  });

  test("register_for_competition qualifies capacity counts with table alias instead of output status", () => {
    const sql = readFileSync(FORWARD_MIGRATION_PATH, "utf8");

    expect(sql).toContain("select cr.*");
    expect(sql).toContain("from public.competition_registrations cr");
    expect(sql).toContain(
      "where cr.competition_id = p_competition_id\n      and cr.profile_id = v_actor_id",
    );
    expect(sql).toContain(
      "where cr.competition_id = p_competition_id\n      and cr.status = 'registered'::public.registration_status",
    );
    expect(sql).toContain("update public.competition_registrations as cr");
    expect(sql).toContain("where cr.id = v_registration.id");
    expect(sql).toContain(
      "grant execute on function public.register_for_competition(uuid, uuid, text) to authenticated, service_role;",
    );
  });

  test("register_for_competition treats default registration start as already open", () => {
    const sql = readFileSync(DEFAULT_REGISTRATION_WINDOW_MIGRATION_PATH, "utf8");

    expect(sql).toContain(
      "v_effective_registration_end := coalesce(v_competition.registration_end, v_competition.start_time);",
    );
    expect(sql).toContain("if v_effective_registration_end is null then");
    expect(sql).toContain(
      "if v_competition.registration_start is not null and v_now < v_competition.registration_start then",
    );
    expect(sql).not.toContain("registration_start is null or v_competition.registration_end is null");
  });

  test("validate_team_registration qualifies team_id references to avoid output-parameter ambiguity", () => {
    const sql = readFileSync(VALIDATE_TEAM_REGISTRATION_MIGRATION_PATH, "utf8");

    expect(sql).toContain("returns table (\n  machine_code text,\n  team_id uuid,");
    expect(sql).toContain("from public.team_memberships tm");
    expect(sql).toContain("where tm.team_id = p_team_id");
    expect(sql).toContain("and tm_other.team_id <> p_team_id");
    expect(sql).toContain("on cr.team_id = tm_other.team_id");
    expect(sql).not.toContain("where team_id = p_team_id");
  });

  test("register_for_competition qualifies team lookup and does not reuse overwritten FOUND state", () => {
    const sql = readFileSync(VALIDATE_TEAM_REGISTRATION_MIGRATION_PATH, "utf8");

    expect(sql).toContain(
      "from public.competition_registrations cr\n  where cr.competition_id = p_competition_id\n    and cr.team_id = p_team_id",
    );
    expect(sql).toContain("from public.validate_team_registration(p_team_id, p_competition_id) vtr");
    expect(sql).toContain("v_existing_registration := found;");
    expect(sql).toContain("if v_existing_registration then");
  });

  test("team registration RLS helper and policies qualify team membership references", () => {
    const sql = readFileSync(TEAM_REGISTRATION_RLS_HARDENING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("from public.team_memberships tm");
    expect(sql).toContain("where tm.team_id = p_team_id");
    expect(sql).toContain("public.is_active_team_member(teams.id, auth.uid())");
    expect(sql).toContain("public.is_active_team_member(team_memberships.team_id, auth.uid())");
    expect(sql).toContain(
      "public.is_active_team_member(competition_registrations.team_id, auth.uid())",
    );
    expect(sql).toContain("where c.id = competition_registrations.competition_id");
  });

  test("team registration ambiguity fix has a database-side verification guard", () => {
    const sql = readFileSync(TEAM_REGISTRATION_VERIFY_MIGRATION_PATH, "utf8");

    expect(sql).toContain("pg_get_functiondef('public.validate_team_registration(uuid, uuid)'::regprocedure)");
    expect(sql).toContain("where team_id = p_team_id");
    expect(sql).toContain("where tm.team_id = p_team_id");
    expect(sql).toContain("pg_get_functiondef('public.register_for_competition(uuid, uuid, text)'::regprocedure)");
    expect(sql).toContain("v_existing_registration := found");
  });

  test("end_competition qualifies event lookup and returning status columns", () => {
    const sql = readFileSync(LIFECYCLE_FORWARD_MIGRATION_PATH, "utf8");

    expect(sql).toContain("from public.competition_events ce");
    expect(sql).toContain("where ce.competition_id = p_competition_id");
    expect(sql).toContain("and ce.request_idempotency_token = v_token");
    expect(sql).toContain("update public.competitions as c");
    expect(sql).toContain("returning c.status");
  });
});
