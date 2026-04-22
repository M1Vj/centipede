import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const MIGRATION_PATH = join(process.cwd(), "supabase/migrations/20260421100000_11_arena_core.sql");

describe("arena sql contracts", () => {
  test("team interval close remains leader-only", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toContain("create or replace function public.close_active_attempt_interval(");
    expect(sql).toContain("and role = 'leader'");
  });

  test("actor-aware arena rpc execute privileges stay service-role only", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");

    expect(sql).toContain("revoke all on function public.register_for_competition(uuid, uuid, uuid) from anon, authenticated;");
    expect(sql).toContain("revoke all on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) from anon, authenticated;");
    expect(sql).toContain("grant execute on function public.submit_competition_attempt(uuid, uuid, text, text) to service_role;");
  });
});
