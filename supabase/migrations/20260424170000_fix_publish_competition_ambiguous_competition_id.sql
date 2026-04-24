-- ============================================================================
-- Forward fix: qualify competition_events references inside publish_competition
-- ============================================================================

create or replace function public.publish_competition(
  p_competition_id uuid,
  p_request_idempotency_token text
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  event_id uuid,
  request_idempotency_token text,
  replayed boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_event_id uuid;
  v_actor_user_id uuid := auth.uid();
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_payload jsonb;
  v_payload_hash text;
  v_snapshot_machine_code text;
  v_snapshot_selected_count bigint;
  v_snapshot_count bigint;
  v_snapshot_hash text;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query
      select 'competition_id_required', null::uuid, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_token = '' then
    return query
      select 'request_idempotency_token_required', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object('request_idempotency_token', v_token);
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:publish:'
      || p_competition_id::text
      || ':'
      || coalesce(v_actor_user_id::text, '00000000-0000-0000-0000-000000000000')
      || ':'
      || v_token
    )
  );

  select *
  into v_event
  from public.competition_events ce
  where ce.competition_id = p_competition_id
    and ce.control_action = 'publish_competition'
    and coalesce(ce.actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ce.request_idempotency_token = v_token
  order by ce.happened_at desc, ce.id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_published'
       and v_event.payload_hash is not distinct from v_payload_hash then
      return query
        select
          coalesce(v_event.metadata_json ->> 'machine_code', 'ok'),
          p_competition_id,
          coalesce((v_event.metadata_json ->> 'result_status')::public.competition_status, v_competition.status),
          v_event.id,
          v_token,
          true,
          false;
      return;
    end if;

    raise exception 'idempotency_key_reused_with_different_payload';
  end if;

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.status <> 'draft'::public.competition_status then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  select
    s.machine_code,
    s.selected_problem_count,
    s.snapshotted_count,
    s.snapshot_hash
  into
    v_snapshot_machine_code,
    v_snapshot_selected_count,
    v_snapshot_count,
    v_snapshot_hash
  from public.snapshot_competition_problems(p_competition_id) s
  limit 1;

  if v_snapshot_machine_code is distinct from 'ok' then
    return query
      select coalesce(v_snapshot_machine_code, 'snapshot_failed'), p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions
  set status = 'published'::public.competition_status,
      scoring_snapshot_json = coalesce(
        scoring_snapshot_json,
        jsonb_build_object(
          'scoring_mode', scoring_mode,
          'custom_points', custom_points,
          'penalty_mode', penalty_mode,
          'deduction_value', deduction_value,
          'tie_breaker', tie_breaker,
          'multi_attempt_grading_mode', multi_attempt_grading_mode,
          'attempts_allowed', attempts_allowed,
          'shuffle_questions', shuffle_questions,
          'shuffle_options', shuffle_options,
          'log_tab_switch', log_tab_switch,
          'offense_penalties', offense_penalties,
          'answer_key_visibility', answer_key_visibility
        )
      ),
      published_at = coalesce(published_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_competition_id
  returning status
  into v_competition.status;

  insert into public.competition_events (
    competition_id,
    event_type,
    actor_user_id,
    control_action,
    request_idempotency_token,
    payload_hash,
    payload_json,
    metadata_json
  )
  values (
    p_competition_id,
    'competition_published',
    v_actor_user_id,
    'publish_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'published',
      'selected_problem_count', v_snapshot_selected_count,
      'snapshotted_count', v_snapshot_count,
      'snapshot_hash', v_snapshot_hash,
      'target_status', 'published'
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;
