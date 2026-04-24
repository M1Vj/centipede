import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const FORWARD_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260425065500_12_fix_authenticated_registration_ambiguity.sql",
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

  test("end_competition qualifies event lookup and returning status columns", () => {
    const sql = readFileSync(LIFECYCLE_FORWARD_MIGRATION_PATH, "utf8");

    expect(sql).toContain("from public.competition_events ce");
    expect(sql).toContain("where ce.competition_id = p_competition_id");
    expect(sql).toContain("and ce.request_idempotency_token = v_token");
    expect(sql).toContain("update public.competitions as c");
    expect(sql).toContain("returning c.status");
  });
});
