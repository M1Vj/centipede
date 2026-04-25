-- ============================================================================
-- Branch 08 follow-up: disambiguate start_competition status return target
-- ============================================================================

create or replace function public.start_competition(
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
      'competition_lifecycle:start:'
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
    and ce.control_action = 'start_competition'
    and coalesce(ce.actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ce.request_idempotency_token = v_token
  order by ce.happened_at desc, ce.id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_started'
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

  if v_competition.status <> 'published'::public.competition_status then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions as c
  set status = 'live'::public.competition_status,
      updated_at = timezone('utc', now())
  where c.id = p_competition_id
  returning c.status
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
    'competition_started',
    v_actor_user_id,
    'start_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'live',
      'target_status', 'live'
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;
