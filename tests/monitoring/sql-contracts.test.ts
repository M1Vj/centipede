import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const PARTICIPANT_MONITORING_MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260506160000_16_participant_monitoring.sql",
);

describe("participant monitoring sql contracts", () => {
  test("live control RPCs are service-role security definer functions", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("add column if not exists updated_at timestamptz not null");
    expect(sql).toContain("create or replace function public.pause_competition");
    expect(sql).toContain("create or replace function public.resume_competition");
    expect(sql).toContain("create or replace function public.extend_competition");
    expect(sql).toContain("create or replace function public.reset_attempt_for_disconnect");
    expect(sql).toContain("create or replace function public.moderate_delete_competition");
    expect(sql).toContain("p_competition_id uuid,\n  p_attempt_id uuid,");
    expect(sql).toContain("security definer");
    expect(sql).toContain("if auth.role() <> 'service_role' then");
    expect(sql).toContain("grant execute on function public.pause_competition(uuid, text, text, uuid, text) to service_role");
    expect(sql).toContain("grant execute on function public.reset_attempt_for_disconnect(uuid, uuid, text, text, uuid, text, uuid) to service_role");
  });

  test("control event lookup uses aliases and idempotency token contract", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("from public.competition_events ce");
    expect(sql).toContain("where ce.competition_id = p_competition_id");
    expect(sql).toContain("and ce.control_action = p_control_action");
    expect(sql).toContain("and ce.actor_user_id = p_actor_user_id");
    expect(sql).toContain("and ce.request_idempotency_token = v_token");
    expect(sql).toContain("request_idempotency_token");
    expect(sql).toContain("payload_hash");
    expect(sql).toContain("payload_json");
    expect(sql).toContain("metadata_json");
  });

  test("disconnect reset applies deterministic rejection precedence and duplicate window boundary", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    const missing = sql.indexOf("rejected_missing_required_tuple");
    const invalid = sql.indexOf("rejected_invalid_evidence_taxonomy");
    const ineligible = sql.indexOf("rejected_ineligible_attempt_state");
    const stale = sql.indexOf("rejected_stale_evidence");
    const duplicate = sql.indexOf("rejected_duplicate_window");

    expect(missing).toBeGreaterThan(-1);
    expect(invalid).toBeGreaterThan(missing);
    expect(ineligible).toBeGreaterThan(invalid);
    expect(stale).toBeGreaterThan(ineligible);
    expect(duplicate).toBeGreaterThan(stale);
    expect(sql).toContain("ce.happened_at > v_now - interval '10 minutes'");
    expect(sql).not.toContain("ce.happened_at >= v_now - interval '10 minutes'");
    expect(sql).toContain("v_event := public._monitoring_replay_control_event(v_attempt.competition_id, 'reset_attempt_for_disconnect', p_actor_user_id, v_token)");
    expect(sql).toContain("if p_competition_id is not null and v_attempt.competition_id <> p_competition_id then");
  });

  test("disconnect reset requires newest qualifying evidence and records observed time on rejections", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("v_detection.id <> p_disconnect_evidence_ref");
    expect(sql).toContain("order by coalesce((ce.metadata_json ->> 'disconnect_evidence_observed_at')::timestamptz, ce.happened_at) desc, ce.happened_at desc, ce.id desc");
    expect(sql).toContain("'disconnect_evidence_observed_at', coalesce(v_detection.metadata_json ->> 'disconnect_evidence_observed_at', v_detection.happened_at::text)");
    expect(sql).toContain("'newest_disconnect_evidence_ref', v_detection.id");
  });

  test("disconnect evidence taxonomy maps to canonical detection events", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("attempt_heartbeat_timeout_detected");
    expect(sql).toContain("platform_connection_drop_detected");
    expect(sql).toContain("resume_handshake_reconnect_detected");
    expect(sql).toContain("attempt_disconnect_reset_applied");
    expect(sql).toContain("attempt_disconnect_reset_rejected");
    expect(sql).toContain("decision_outcome");
  });

  test("admin boundary excludes organizer-only live controls", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("p_actor_role text default 'organizer'");
    expect(sql).toContain("p_actor_role = 'admin'");
    expect(sql).toContain("then 'force_pause_competition'");
    expect(sql).toContain("'moderate_delete_competition'");
    expect(sql).not.toContain("control_action = 'admin_resume_competition'");
    expect(sql).not.toContain("control_action = 'admin_extend_competition'");
    expect(sql).not.toContain("control_action = 'admin_reset_attempt_for_disconnect'");
  });

  test("monitoring controls block soft-deleted competitions and moderation rejection writes admin audit", () => {
    const sql = readFileSync(PARTICIPANT_MONITORING_MIGRATION_PATH, "utf8");

    expect(sql).toContain("if coalesce(v_competition.is_deleted, false) then");
    expect(sql).toContain("return query select 'deleted', p_competition_id, v_competition.status");
    expect(sql).toContain("return query select 'deleted', v_attempt.competition_id, v_attempt.status");
    expect(sql).toContain("insert into public.admin_audit_logs");
    expect(sql).toContain("'moderate_delete_competition_rejected'");
    expect(sql).toContain("'decision_outcome', 'invalid_transition'");
  });
});
