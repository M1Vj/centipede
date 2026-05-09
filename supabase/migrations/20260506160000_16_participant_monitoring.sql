begin;

create table if not exists public.competition_announcements (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  audience text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  metadata_json jsonb not null default '{}'::jsonb,
  constraint competition_announcements_audience_chk check (
    audience in ('registered_only', 'registered_and_ineligible', 'all_non_cancelled', 'operators_only')
  ),
  constraint competition_announcements_title_not_blank_chk check (nullif(btrim(title), '') is not null),
  constraint competition_announcements_body_not_blank_chk check (nullif(btrim(body), '') is not null)
);

alter table public.competition_announcements enable row level security;

create index if not exists competition_announcements_competition_created_idx
  on public.competition_announcements (competition_id, created_at desc);

create index if not exists competition_events_monitoring_timeline_idx
  on public.competition_events (competition_id, happened_at desc);

create index if not exists competition_events_disconnect_detection_idx
  on public.competition_events (
    competition_id,
    event_type,
    ((metadata_json ->> 'attempt_id')),
    happened_at desc
  )
  where event_type in (
    'attempt_heartbeat_timeout_detected',
    'platform_connection_drop_detected',
    'resume_handshake_reconnect_detected'
  );

alter table public.competition_attempts
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists competition_attempts_monitoring_status_idx
  on public.competition_attempts (competition_id, status, effective_attempt_deadline_at);

grant select, insert on public.competition_announcements to service_role;

create or replace function public._monitoring_replay_control_event(
  p_competition_id uuid,
  p_control_action text,
  p_actor_user_id uuid,
  p_request_idempotency_token text
)
returns public.competition_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
begin
  select *
  into v_event
  from public.competition_events ce
  where ce.competition_id = p_competition_id
    and ce.control_action = p_control_action
    and ce.actor_user_id = p_actor_user_id
    and ce.request_idempotency_token = v_token
  order by ce.happened_at desc, ce.id desc
  limit 1;

  return v_event;
end;
$$;

create or replace function public._monitoring_record_control_event(
  p_competition_id uuid,
  p_actor_user_id uuid,
  p_event_type text,
  p_control_action text,
  p_request_idempotency_token text,
  p_payload_json jsonb,
  p_metadata_json jsonb
)
returns public.competition_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.competition_events%rowtype;
  v_payload jsonb := coalesce(p_payload_json, '{}'::jsonb);
begin
  insert into public.competition_events (
    competition_id,
    actor_user_id,
    event_type,
    control_action,
    request_idempotency_token,
    payload_hash,
    payload_json,
    metadata_json
  )
  values (
    p_competition_id,
    p_actor_user_id,
    p_event_type,
    p_control_action,
    btrim(coalesce(p_request_idempotency_token, '')),
    encode(extensions.digest(v_payload::text, 'sha256'), 'hex'),
    v_payload,
    coalesce(p_metadata_json, '{}'::jsonb)
  )
  returning *
  into v_event;

  return v_event;
end;
$$;

create or replace function public.pause_competition(
  p_competition_id uuid,
  p_reason text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null,
  p_actor_role text default 'organizer'
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  event_id uuid,
  replayed boolean,
  changed boolean,
  request_idempotency_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_control_action text := case when p_actor_role = 'admin' then 'force_pause_competition' else 'pause_competition' end;
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_reason = '' then
    return query select 'reason_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  v_event := public._monitoring_replay_control_event(p_competition_id, v_control_action, p_actor_user_id, v_token);
  if v_event.id is not null then
    select *
    into v_competition
    from public.competitions c
    where c.id = p_competition_id;

    return query select 'ok', p_competition_id, v_competition.status, v_event.id, true, false, v_token;
    return;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id
  for update;

  if not found then
    return query select 'not_found', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if coalesce(v_competition.is_deleted, false) then
    return query select 'deleted', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  if p_actor_role = 'admin' then
    if not exists (
      select 1 from public.profiles p
      where p.id = p_actor_user_id
        and p.role = 'admin'
        and coalesce(p.is_active, true) = true
    ) then
      return query select 'forbidden', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
      return;
    end if;
  elsif v_competition.organizer_id <> p_actor_user_id or v_competition.type <> 'open'::public.competition_type then
    return query select 'forbidden', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_competition.status <> 'live'::public.competition_status then
    return query select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  update public.competitions as c
  set status = 'paused'::public.competition_status,
      updated_at = timezone('utc', now())
  where c.id = p_competition_id
  returning *
  into v_competition;

  v_event := public._monitoring_record_control_event(
    p_competition_id,
    p_actor_user_id,
    case when p_actor_role = 'admin' then 'competition_force_paused' else 'competition_paused' end,
    v_control_action,
    v_token,
    jsonb_build_object('competition_id', p_competition_id, 'status', v_competition.status),
    jsonb_build_object('reason', v_reason, 'actor_role', p_actor_role)
  );

  return query select 'ok', p_competition_id, v_competition.status, v_event.id, false, true, v_token;
end;
$$;

create or replace function public.resume_competition(
  p_competition_id uuid,
  p_reason text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null,
  p_actor_role text default 'organizer'
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  event_id uuid,
  replayed boolean,
  changed boolean,
  request_idempotency_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if p_actor_role = 'admin' then
    return query select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_reason = '' then
    return query select 'reason_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  v_event := public._monitoring_replay_control_event(p_competition_id, 'resume_competition', p_actor_user_id, v_token);
  if v_event.id is not null then
    select * into v_competition from public.competitions c where c.id = p_competition_id;
    return query select 'ok', p_competition_id, v_competition.status, v_event.id, true, false, v_token;
    return;
  end if;

  select * into v_competition from public.competitions c where c.id = p_competition_id for update;
  if not found then
    return query select 'not_found', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if coalesce(v_competition.is_deleted, false) then
    return query select 'deleted', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_competition.organizer_id <> p_actor_user_id then
    return query select 'forbidden', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_competition.status <> 'paused'::public.competition_status then
    return query select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  update public.competitions as c
  set status = 'live'::public.competition_status,
      updated_at = timezone('utc', now())
  where c.id = p_competition_id
  returning *
  into v_competition;

  v_event := public._monitoring_record_control_event(
    p_competition_id,
    p_actor_user_id,
    'competition_resumed',
    'resume_competition',
    v_token,
    jsonb_build_object('competition_id', p_competition_id, 'status', v_competition.status),
    jsonb_build_object('reason', v_reason, 'actor_role', p_actor_role)
  );

  return query select 'ok', p_competition_id, v_competition.status, v_event.id, false, true, v_token;
end;
$$;

create or replace function public.extend_competition(
  p_competition_id uuid,
  p_additional_minutes integer,
  p_reason text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null,
  p_actor_role text default 'organizer'
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  event_id uuid,
  replayed boolean,
  changed boolean,
  request_idempotency_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.role() <> 'service_role' or p_actor_role = 'admin' then
    return query select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_reason = '' then
    return query select 'reason_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if coalesce(p_additional_minutes, 0) <= 0 then
    return query select 'invalid_additional_minutes', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  v_event := public._monitoring_replay_control_event(p_competition_id, 'extend_competition', p_actor_user_id, v_token);
  if v_event.id is not null then
    select * into v_competition from public.competitions c where c.id = p_competition_id;
    return query select 'ok', p_competition_id, v_competition.status, v_event.id, true, false, v_token;
    return;
  end if;

  select * into v_competition from public.competitions c where c.id = p_competition_id for update;
  if not found then
    return query select 'not_found', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if coalesce(v_competition.is_deleted, false) then
    return query select 'deleted', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_competition.organizer_id <> p_actor_user_id then
    return query select 'forbidden', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_competition.status not in ('live'::public.competition_status, 'paused'::public.competition_status) then
    return query select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  update public.competition_attempts as ca
  set effective_attempt_deadline_at = coalesce(ca.effective_attempt_deadline_at, ca.attempt_base_deadline_at, ca.started_at) + make_interval(mins => p_additional_minutes),
      updated_at = timezone('utc', now())
  where ca.competition_id = p_competition_id
    and ca.status = 'in_progress'::public.attempt_status;

  update public.competitions as c
  set updated_at = timezone('utc', now())
  where c.id = p_competition_id
  returning *
  into v_competition;

  v_event := public._monitoring_record_control_event(
    p_competition_id,
    p_actor_user_id,
    'competition_extended',
    'extend_competition',
    v_token,
    jsonb_build_object('competition_id', p_competition_id, 'additional_minutes', p_additional_minutes),
    jsonb_build_object('reason', v_reason, 'actor_role', p_actor_role)
  );

  return query select 'ok', p_competition_id, v_competition.status, v_event.id, false, true, v_token;
end;
$$;

create or replace function public.reset_attempt_for_disconnect(
  p_competition_id uuid,
  p_attempt_id uuid,
  p_reason text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null,
  p_disconnect_evidence_type text default null,
  p_disconnect_evidence_ref uuid default null
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.attempt_status,
  event_id uuid,
  replayed boolean,
  changed boolean,
  request_idempotency_token text,
  decision_outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_competition public.competitions%rowtype;
  v_detection public.competition_events%rowtype;
  v_duplicate public.competition_events%rowtype;
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
  v_now timestamptz := timezone('utc', now());
  v_decision text;
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden', null::uuid, null::public.attempt_status, null::uuid, false, false, v_token, null::text;
    return;
  end if;

  if p_attempt_id is not null then
    select *
    into v_attempt
    from public.competition_attempts ca
    where ca.id = p_attempt_id;
  end if;

  if p_attempt_id is null or v_attempt.id is null then
    return query select 'attempt_not_found', p_competition_id, null::public.attempt_status, null::uuid, false, false, v_token, null::text;
    return;
  end if;

  if p_competition_id is not null and v_attempt.competition_id <> p_competition_id then
    return query select 'forbidden', v_attempt.competition_id, v_attempt.status, null::uuid, false, false, v_token, null::text;
    return;
  end if;

  if v_reason = '' or v_token = '' then
    v_decision := 'rejected_missing_required_tuple';
    v_event := public._monitoring_record_control_event(
      v_attempt.competition_id,
      p_actor_user_id,
      'attempt_disconnect_reset_rejected',
      'reset_attempt_for_disconnect',
      coalesce(nullif(v_token, ''), extensions.gen_random_uuid()::text),
      jsonb_build_object('attempt_id', p_attempt_id),
      jsonb_build_object('decision_outcome', v_decision, 'reason', v_reason, 'request_idempotency_token', v_token, 'actor_user_id', p_actor_user_id)
    );
    return query select v_decision, null::uuid, null::public.attempt_status, v_event.id, false, false, v_token, v_decision;
    return;
  end if;

  v_event := public._monitoring_replay_control_event(v_attempt.competition_id, 'reset_attempt_for_disconnect', p_actor_user_id, v_token);
  if v_event.id is not null then
    v_decision := coalesce(v_event.metadata_json ->> 'decision_outcome', 'approved');
    return query select
      case when v_event.event_type = 'attempt_disconnect_reset_applied' then 'ok' else v_decision end,
      v_attempt.competition_id,
      v_attempt.status,
      v_event.id,
      true,
      false,
      v_token,
      v_decision;
    return;
  end if;

  if p_disconnect_evidence_type not in ('attempt_heartbeat_timeout', 'platform_connection_drop', 'resume_handshake_reconnect') then
    v_decision := 'rejected_invalid_evidence_taxonomy';
    v_event := public._monitoring_record_control_event(
      v_attempt.competition_id,
      p_actor_user_id,
      'attempt_disconnect_reset_rejected',
      'reset_attempt_for_disconnect',
      v_token,
      jsonb_build_object('attempt_id', p_attempt_id),
      jsonb_build_object('decision_outcome', v_decision, 'disconnect_evidence_type', p_disconnect_evidence_type, 'disconnect_evidence_ref', p_disconnect_evidence_ref, 'reason', v_reason, 'request_idempotency_token', v_token, 'actor_user_id', p_actor_user_id)
    );
    return query select v_decision, null::uuid, null::public.attempt_status, v_event.id, false, false, v_token, v_decision;
    return;
  end if;

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found or v_attempt.status <> 'in_progress'::public.attempt_status then
    v_decision := 'rejected_ineligible_attempt_state';
    v_event := public._monitoring_record_control_event(
      coalesce(v_attempt.competition_id, null),
      p_actor_user_id,
      'attempt_disconnect_reset_rejected',
      'reset_attempt_for_disconnect',
      v_token,
      jsonb_build_object('attempt_id', p_attempt_id),
      jsonb_build_object('decision_outcome', v_decision, 'attempt_id', p_attempt_id, 'disconnect_evidence_type', p_disconnect_evidence_type, 'disconnect_evidence_ref', p_disconnect_evidence_ref, 'reason', v_reason, 'request_idempotency_token', v_token, 'actor_user_id', p_actor_user_id)
    );
    return query select v_decision, v_attempt.competition_id, v_attempt.status, v_event.id, false, false, v_token, v_decision;
    return;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = v_attempt.competition_id;

  if v_competition.organizer_id <> p_actor_user_id then
    return query select 'forbidden', v_attempt.competition_id, v_attempt.status, null::uuid, false, false, v_token, null::text;
    return;
  end if;

  if coalesce(v_competition.is_deleted, false) then
    return query select 'deleted', v_attempt.competition_id, v_attempt.status, null::uuid, false, false, v_token, null::text;
    return;
  end if;

  select *
  into v_detection
  from public.competition_events ce
  where ce.competition_id = v_attempt.competition_id
    and (ce.metadata_json ->> 'attempt_id') = p_attempt_id::text
    and ce.event_type = case p_disconnect_evidence_type
      when 'attempt_heartbeat_timeout' then 'attempt_heartbeat_timeout_detected'
      when 'platform_connection_drop' then 'platform_connection_drop_detected'
      when 'resume_handshake_reconnect' then 'resume_handshake_reconnect_detected'
    end
    and coalesce((ce.metadata_json ->> 'disconnect_evidence_observed_at')::timestamptz, ce.happened_at) >= v_now - interval '120 seconds'
  order by coalesce((ce.metadata_json ->> 'disconnect_evidence_observed_at')::timestamptz, ce.happened_at) desc, ce.happened_at desc, ce.id desc
  limit 1;

  if not found or v_detection.id <> p_disconnect_evidence_ref then
    v_decision := 'rejected_stale_evidence';
    v_event := public._monitoring_record_control_event(
      v_attempt.competition_id,
      p_actor_user_id,
      'attempt_disconnect_reset_rejected',
      'reset_attempt_for_disconnect',
      v_token,
      jsonb_build_object('attempt_id', p_attempt_id),
      jsonb_build_object(
        'decision_outcome', v_decision,
        'attempt_id', p_attempt_id,
        'disconnect_evidence_type', p_disconnect_evidence_type,
        'disconnect_evidence_ref', p_disconnect_evidence_ref,
        'disconnect_evidence_observed_at', case when v_detection.id is null then null else coalesce(v_detection.metadata_json ->> 'disconnect_evidence_observed_at', v_detection.happened_at::text) end,
        'newest_disconnect_evidence_ref', v_detection.id,
        'reason', v_reason,
        'request_idempotency_token', v_token,
        'actor_user_id', p_actor_user_id
      )
    );
    return query select v_decision, v_attempt.competition_id, v_attempt.status, v_event.id, false, false, v_token, v_decision;
    return;
  end if;

  select *
  into v_duplicate
  from public.competition_events ce
  where ce.competition_id = v_attempt.competition_id
    and ce.control_action = 'reset_attempt_for_disconnect'
    and ce.event_type = 'attempt_disconnect_reset_applied'
    and ce.metadata_json ->> 'attempt_id' = p_attempt_id::text
    and ce.metadata_json ->> 'decision_outcome' = 'approved'
    and ce.happened_at > v_now - interval '10 minutes'
  order by ce.happened_at desc, ce.id desc
  limit 1;

  if found then
    v_decision := 'rejected_duplicate_window';
    v_event := public._monitoring_record_control_event(
      v_attempt.competition_id,
      p_actor_user_id,
      'attempt_disconnect_reset_rejected',
      'reset_attempt_for_disconnect',
      v_token,
      jsonb_build_object('attempt_id', p_attempt_id),
      jsonb_build_object(
        'decision_outcome', v_decision,
        'attempt_id', p_attempt_id,
        'disconnect_evidence_type', p_disconnect_evidence_type,
        'disconnect_evidence_ref', p_disconnect_evidence_ref,
        'disconnect_evidence_observed_at', coalesce(v_detection.metadata_json ->> 'disconnect_evidence_observed_at', v_detection.happened_at::text),
        'reason', v_reason,
        'request_idempotency_token', v_token,
        'actor_user_id', p_actor_user_id
      )
    );
    return query select v_decision, v_attempt.competition_id, v_attempt.status, v_event.id, false, false, v_token, v_decision;
    return;
  end if;

  update public.competition_attempts as ca
  set effective_attempt_deadline_at = greatest(coalesce(ca.effective_attempt_deadline_at, v_now), v_now) + interval '120 seconds',
      updated_at = timezone('utc', now())
  where ca.id = p_attempt_id
  returning *
  into v_attempt;

  v_decision := 'approved';
  v_event := public._monitoring_record_control_event(
    v_attempt.competition_id,
    p_actor_user_id,
    'attempt_disconnect_reset_applied',
    'reset_attempt_for_disconnect',
    v_token,
    jsonb_build_object('attempt_id', p_attempt_id),
    jsonb_build_object('decision_outcome', v_decision, 'attempt_id', p_attempt_id, 'disconnect_evidence_type', p_disconnect_evidence_type, 'disconnect_evidence_observed_at', coalesce(v_detection.metadata_json ->> 'disconnect_evidence_observed_at', v_detection.happened_at::text), 'disconnect_evidence_ref', p_disconnect_evidence_ref, 'reason', v_reason, 'request_idempotency_token', v_token, 'actor_user_id', p_actor_user_id)
  );

  return query select 'ok', v_attempt.competition_id, v_attempt.status, v_event.id, false, true, v_token, v_decision;
end;
$$;

create or replace function public.moderate_delete_competition(
  p_competition_id uuid,
  p_reason text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null,
  p_actor_role text default 'admin'
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  event_id uuid,
  replayed boolean,
  changed boolean,
  request_idempotency_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.role() <> 'service_role' or p_actor_role <> 'admin' then
    return query select 'forbidden', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_reason = '' then
    return query select 'reason_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  v_event := public._monitoring_replay_control_event(p_competition_id, 'moderate_delete_competition', p_actor_user_id, v_token);
  if v_event.id is not null then
    select * into v_competition from public.competitions c where c.id = p_competition_id;
    return query select 'ok', p_competition_id, v_competition.status, v_event.id, true, false, v_token;
    return;
  end if;

  select * into v_competition from public.competitions c where c.id = p_competition_id for update;
  if not found then
    insert into public.admin_audit_logs (
      actor_user_id,
      action_type,
      target_table,
      target_id,
      description,
      metadata
    )
    values (
      p_actor_user_id,
      'moderate_delete_competition_rejected',
      'competitions',
      p_competition_id,
      v_reason,
      jsonb_build_object('decision_outcome', 'not_found', 'request_idempotency_token', v_token)
    );

    return query select 'not_found', p_competition_id, null::public.competition_status, null::uuid, false, false, v_token;
    return;
  end if;

  if v_competition.status = 'draft'::public.competition_status then
    insert into public.admin_audit_logs (
      actor_user_id,
      action_type,
      target_table,
      target_id,
      description,
      metadata
    )
    values (
      p_actor_user_id,
      'moderate_delete_competition_rejected',
      'competitions',
      p_competition_id,
      v_reason,
      jsonb_build_object('decision_outcome', 'invalid_transition', 'status', v_competition.status, 'request_idempotency_token', v_token)
    );

    return query select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, false, false, v_token;
    return;
  end if;

  update public.competitions as c
  set is_deleted = true,
      updated_at = timezone('utc', now())
  where c.id = p_competition_id
  returning *
  into v_competition;

  v_event := public._monitoring_record_control_event(
    p_competition_id,
    p_actor_user_id,
    'competition_moderation_deleted',
    'moderate_delete_competition',
    v_token,
    jsonb_build_object('competition_id', p_competition_id, 'is_deleted', true),
    jsonb_build_object('reason', v_reason, 'actor_role', p_actor_role)
  );

  insert into public.admin_audit_logs (
    actor_user_id,
    action_type,
    target_table,
    target_id,
    description,
    metadata
  )
  values (
    p_actor_user_id,
    'moderate_delete_competition',
    'competitions',
    p_competition_id,
    v_reason,
    jsonb_build_object('event_id', v_event.id, 'request_idempotency_token', v_token)
  );

  return query select 'ok', p_competition_id, v_competition.status, v_event.id, false, true, v_token;
end;
$$;

grant execute on function public.pause_competition(uuid, text, text, uuid, text) to service_role;
grant execute on function public.resume_competition(uuid, text, text, uuid, text) to service_role;
grant execute on function public.extend_competition(uuid, integer, text, text, uuid, text) to service_role;
grant execute on function public.reset_attempt_for_disconnect(uuid, uuid, text, text, uuid, text, uuid) to service_role;
grant execute on function public.moderate_delete_competition(uuid, text, text, uuid, text) to service_role;

commit;
