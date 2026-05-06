import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const sql = readFileSync("supabase/migrations/20260504130000_13_review_submission.sql", "utf8");
const submitConflictSql = readFileSync(
  "supabase/migrations/20260504130100_13_submit_attempt_variable_conflict.sql",
  "utf8",
);
const gradeTimestampSql = readFileSync(
  "supabase/migrations/20260504130200_13_grade_attempt_timestamp_contract.sql",
  "utf8",
);
const postDevelopSubmitGradeSql = readFileSync(
  "supabase/migrations/20260506120000_13_reapply_submit_grade_contracts_after_develop.sql",
  "utf8",
);
const postDevelopLintContractsSql = readFileSync(
  "supabase/migrations/20260506121000_13_fix_db_lint_contracts_after_develop.sql",
  "utf8",
);

describe("review submission sql contracts", () => {
  test("creates dispute table and state machine enum", () => {
    expect(sql).toContain("create type public.dispute_status as enum");
    expect(sql).toContain("create table if not exists public.problem_disputes");
    expect(sql).toContain("'open'");
    expect(sql).toContain("'reviewing'");
    expect(sql).toContain("'accepted'");
    expect(sql).toContain("'rejected'");
    expect(sql).toContain("'resolved'");
  });

  test("exposes trusted answer-key and dispute RPC contracts", () => {
    expect(sql).toContain("create or replace function public.get_attempt_review_summary");
    expect(sql).toContain("create or replace function public.can_view_answer_key");
    expect(sql).toContain("create or replace function public.get_answer_key_snapshots");
    expect(sql).toContain("create or replace function public.create_problem_dispute");
    expect(sql).toContain("v_competition.answer_key_visibility = 'hidden'");
    expect(sql).toContain("v_competition.status not in ('ended'");
    expect(sql).not.toContain("leaderboard_published");
    expect(sql).toContain("grant execute on function public.create_problem_dispute(uuid, uuid, uuid, uuid, text)");
  });

  test("review summary derives persisted status flags and infers missing rows as blank", () => {
    expect(sql).toContain("count(distinct aa.competition_problem_id)");
    expect(sql).toContain("greatest(v_total_problems - v_distinct_answer_rows, 0)");
    expect(sql).toContain("missing_rows_inferred_blank");
  });

  test("prevents direct duplicate open participant disputes", () => {
    expect(sql).toContain("problem_disputes_one_open_per_attempt_problem_reporter_uq");
    expect(sql).toContain("where status in ('open', 'reviewing')");
    expect(sql).toContain("'already_open'");
    expect(sql).toContain("dispute_spam_window");
    expect(sql).toContain("'dispute_rate_limited'");
  });

  test("hardens trusted submit and grade contracts used by final review", () => {
    expect(submitConflictSql).toContain("#variable_conflict use_column");
    expect(submitConflictSql).toContain("where ai.attempt_id = p_attempt_id");
    expect(submitConflictSql).toContain("where ca.registration_id = v_attempt.registration_id");
    expect(gradeTimestampSql).toContain("graded_at timestamptz");
    expect(gradeTimestampSql).toContain("now()");
    expect(gradeTimestampSql).not.toContain("timezone('utc', now())");
    expect(postDevelopSubmitGradeSql).toContain("create or replace function public.submit_competition_attempt");
    expect(postDevelopSubmitGradeSql).toContain("create or replace function public.grade_attempt");
    expect(postDevelopSubmitGradeSql).toContain("#variable_conflict use_column");
    expect(postDevelopSubmitGradeSql).toContain("where ca.registration_id = v_attempt.registration_id");
    expect(postDevelopSubmitGradeSql).toContain("grant execute on function public.grade_attempt(uuid) to service_role");
  });

  test("keeps post-develop database contracts lint-clean for participant submit dependencies", () => {
    expect(postDevelopLintContractsSql).toContain("create or replace function public.resume_competition_attempt");
    expect(postDevelopLintContractsSql).toContain("where ai.attempt_id = p_attempt_id");
    expect(postDevelopLintContractsSql).toContain("from public.competition_events ce");
    expect(postDevelopLintContractsSql).toContain("and ce.request_idempotency_token = v_token");
    expect(postDevelopLintContractsSql).toContain("and oa.profile_id is null");
    expect(postDevelopLintContractsSql).toContain("now();");
    expect(postDevelopLintContractsSql).not.toContain("timezone('utc', now())");
  });
});
