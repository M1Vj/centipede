import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const migration = readFileSync("supabase/migrations/20260504160000_14b_leaderboard_history.sql", "utf8");

describe("branch 14 SQL contracts", () => {
  test("keeps event-producing leaderboard RPCs service-role only", () => {
    expect(migration).toContain(
      "grant execute on function public.publish_leaderboard(uuid, text, uuid) to service_role;",
    );
    expect(migration).toContain(
      "grant execute on function public.queue_export_job(uuid, public.export_job_format, text, text, uuid) to service_role;",
    );
    expect(migration).toContain(
      "grant execute on function public.resolve_problem_dispute(uuid, public.dispute_status, text, text, uuid) to service_role;",
    );
    expect(migration).not.toContain(
      "grant execute on function public.publish_leaderboard(uuid, text, uuid) to authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.queue_export_job(uuid, public.export_job_format, text, text, uuid) to authenticated",
    );
    expect(migration).not.toContain(
      "grant execute on function public.resolve_problem_dispute(uuid, public.dispute_status, text, text, uuid) to authenticated",
    );
  });

  test("stores export files as scoped storage paths instead of raw download URLs", () => {
    expect(migration).toContain("storage_path text");
    expect(migration).not.toContain("download_url text");
  });

  test("accepted dispute follow-through recalculates and refreshes leaderboard entries", () => {
    expect(migration).toContain("from public.record_competition_problem_correction(");
    expect(migration).toContain("select rpc_result.correction_id");
    expect(migration).toContain("from public.recalculate_competition_scores(");
    expect(migration).toContain("select recalc_result.machine_code");
    expect(migration).toContain("from public.refresh_leaderboard_entries(v_competition.id) rle");
    expect(migration).toContain("on conflict on constraint leaderboard_entries_competition_registration_uq");
    expect(migration).toContain("'problem_dispute_resolved'");
  });

  test("aligns branch 13 dispute table with branch 14 update trigger", () => {
    expect(migration).toContain("add column if not exists updated_at timestamptz not null default timezone('utc', now())");
    expect(migration).toContain("new.updated_at := timezone('utc', now())");
  });
});
