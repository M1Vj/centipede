import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

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
});
