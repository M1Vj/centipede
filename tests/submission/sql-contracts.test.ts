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
const leaderboardSubmitRestoreSql = readFileSync(
  "supabase/migrations/20260506123000_14_restore_submit_grading_leaderboard.sql",
  "utf8",
);
const submitGradingAmbiguityFixSql = readFileSync(
  "supabase/migrations/20260603100000_fix_submit_grading_rpc_ambiguity.sql",
  "utf8",
);
const leaderboardUuidStableAttemptFixSql = readFileSync(
  "supabase/migrations/20260603103000_fix_leaderboard_uuid_stable_attempt.sql",
  "utf8",
);
const answerKeyVisibilityReleaseSql = readFileSync(
  "supabase/migrations/20260603110000_answer_key_visibility_release.sql",
  "utf8",
);
const answerKeyNotificationSql = readFileSync(
  "supabase/migrations/20260603111000_answer_key_release_notifications.sql",
  "utf8",
);
const manualEndAnswerKeyVisibilitySql = readFileSync(
  "supabase/migrations/20260603112000_manual_end_answer_key_visibility.sql",
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

  test("restores final submit grading and leaderboard refresh after branch 13 stubs", () => {
    expect(leaderboardSubmitRestoreSql).toContain("create or replace function public.grade_attempt");
    expect(leaderboardSubmitRestoreSql).toContain("update public.attempt_answers aa");
    expect(leaderboardSubmitRestoreSql).toContain("points_awarded = case when answer_scores.is_correct");
    expect(leaderboardSubmitRestoreSql).toContain("->> 'acceptedAnswer'");
    expect(leaderboardSubmitRestoreSql).toContain("->> 'accepted_answer'");
    expect(leaderboardSubmitRestoreSql).toContain("-> 'accepted_answers'");
    expect(leaderboardSubmitRestoreSql).toContain("update public.competition_attempts ca");
    expect(leaderboardSubmitRestoreSql).toContain("raw_score = v_raw_score");
    expect(leaderboardSubmitRestoreSql).toContain("create or replace function public.refresh_leaderboard_entries");
    expect(leaderboardSubmitRestoreSql).toContain("partition by ca.registration_id");
    expect(leaderboardSubmitRestoreSql).toContain("official_attempt_rank = 1");
    expect(leaderboardSubmitRestoreSql).toContain("set is_latest_visible_result = exists");
    expect(leaderboardSubmitRestoreSql).toContain("), ranked_attempts as");
    expect(leaderboardSubmitRestoreSql).toContain("on conflict on constraint leaderboard_entries_competition_registration_uq");
    expect(leaderboardSubmitRestoreSql).toContain("perform public.refresh_leaderboard_entries(v_attempt.competition_id)");
    expect(leaderboardSubmitRestoreSql).not.toContain("and coalesce(ca.is_latest_visible_result, true) = true");
    expect(leaderboardSubmitRestoreSql).not.toContain("'deferred_owner_schema'::text");
  });

  test("hardens live submit grading dependencies against output-column ambiguity", () => {
    expect(submitGradingAmbiguityFixSql).toContain("create or replace function public.grade_attempt");
    expect(submitGradingAmbiguityFixSql).toContain("create or replace function public.refresh_leaderboard_entries");
    expect(submitGradingAmbiguityFixSql.match(/#variable_conflict use_column/g)).toHaveLength(2);
    expect(submitGradingAmbiguityFixSql).toContain("where aa.attempt_id = p_attempt_id");
    expect(submitGradingAmbiguityFixSql).toContain("partition by ca.registration_id, ca.participant_profile_id");
    expect(submitGradingAmbiguityFixSql).toContain("sum(coalesce(oma.final_score, 0)) as score");
    expect(submitGradingAmbiguityFixSql).toContain("grant execute on function public.grade_attempt(uuid) to service_role");
    expect(submitGradingAmbiguityFixSql).toContain(
      "grant execute on function public.refresh_leaderboard_entries(uuid) to service_role",
    );
    expect(submitGradingAmbiguityFixSql).not.toContain("'deferred_owner_schema'::text");
  });

  test("uses a uuid-safe stable leaderboard tie breaker", () => {
    expect(leaderboardUuidStableAttemptFixSql).toContain(
      "create or replace function public.refresh_leaderboard_entries",
    );
    expect(leaderboardUuidStableAttemptFixSql).toContain("#variable_conflict use_column");
    expect(leaderboardUuidStableAttemptFixSql).toContain("(array_agg(oma.id order by oma.id asc))[1] as stable_attempt_id");
    expect(leaderboardUuidStableAttemptFixSql).toContain("rs.stable_attempt_id asc");
    expect(leaderboardUuidStableAttemptFixSql).not.toContain("min(oma.id)");
  });

  test("aligns answer-key RPC visibility with scheduled and open competition policies", () => {
    expect(answerKeyVisibilityReleaseSql).toContain("create or replace function public.can_view_answer_key");
    expect(answerKeyVisibilityReleaseSql).toContain("v_competition.type = 'open'::public.competition_type");
    expect(answerKeyVisibilityReleaseSql).toContain("v_latest_attempt.status = 'in_progress'::public.attempt_status");
    expect(answerKeyVisibilityReleaseSql).toContain("v_latest_attempt.attempt_no >= greatest");
    expect(answerKeyVisibilityReleaseSql).toContain("v_competition.status in ('draft'");
    expect(answerKeyVisibilityReleaseSql).toContain("now() < v_competition.end_time");
    expect(answerKeyVisibilityReleaseSql).not.toContain("leaderboard_published");
  });

  test("maps answer-key release notifications in database helpers", () => {
    expect(answerKeyNotificationSql).toContain("create or replace function public.notification_preference_key");
    expect(answerKeyNotificationSql).toContain("when 'answer_key_released' then 'leaderboard_publication'");
    expect(answerKeyNotificationSql).toContain("create or replace function public.notification_requires_mandatory_inbox");
    expect(answerKeyNotificationSql).toContain("'answer_key_released'");
  });

  test("allows manually ended scheduled competitions to reveal answer keys", () => {
    expect(manualEndAnswerKeyVisibilitySql).toContain("create or replace function public.can_view_answer_key");
    expect(manualEndAnswerKeyVisibilitySql).toContain("v_competition.status in ('ended'");
    expect(manualEndAnswerKeyVisibilitySql).toContain("return true;");
    expect(manualEndAnswerKeyVisibilitySql).toContain("now() < v_competition.end_time");
  });
});
