begin;

create or replace function public.recalculate_competition_scores(
  p_competition_id uuid,
  p_request_idempotency_token text
)
returns table (
  competition_id uuid,
  request_idempotency_token text,
  machine_code text,
  graded_attempts bigint,
  refreshed_rows bigint,
  recalculated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend recalculation flows may execute recalculate_competition_scores.';
  end if;

  if p_competition_id is null then
    raise exception 'competition_id is required.';
  end if;

  v_token := btrim(coalesce(p_request_idempotency_token, ''));
  if v_token = '' then
    raise exception 'request_idempotency_token is required.';
  end if;

  return query
  select
    p_competition_id,
    v_token,
    'deferred_owner_schema'::text,
    0::bigint,
    0::bigint,
    now();
end;
$$;

create or replace function public.refresh_leaderboard_entries(p_competition_id uuid)
returns table (
  competition_id uuid,
  machine_code text,
  refreshed_rows bigint,
  computed_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend leaderboard flows may execute refresh_leaderboard_entries.';
  end if;

  if p_competition_id is null then
    raise exception 'competition_id is required.';
  end if;

  return query
  select
    p_competition_id,
    'deferred_owner_schema'::text,
    0::bigint,
    now();
end;
$$;

create or replace function public.provision_organizer_account(
  p_application_id uuid,
  p_profile_id uuid default null::uuid
)
returns table (
  machine_code text,
  application_id uuid,
  profile_id uuid,
  activated boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_application public.organizer_applications%rowtype;
  v_profile_id uuid;
  v_profile_email text;
  v_activated boolean := false;
begin
  perform pg_advisory_xact_lock(hashtext('organizer-provision:' || p_application_id::text));

  select *
  into v_application
  from public.organizer_applications oa
  where oa.id = p_application_id
  for update;

  if not found then
    return query
      select 'not_found', p_application_id, null::uuid, false;
    return;
  end if;

  if v_application.status <> 'approved' then
    return query
      select 'not_approved', v_application.id, v_application.profile_id, false;
    return;
  end if;

  v_profile_id := coalesce(v_application.profile_id, p_profile_id);

  if v_profile_id is null then
    return query
      select 'profile_required', v_application.id, null::uuid, false;
    return;
  end if;

  select p.email
  into v_profile_email
  from public.profiles p
  where p.id = v_profile_id
  for update;

  if not found then
    return query
      select 'profile_not_found', v_application.id, v_profile_id, false;
    return;
  end if;

  if v_application.contact_email is not null and lower(v_profile_email) <> lower(v_application.contact_email) then
    return query
      select 'profile_email_mismatch', v_application.id, v_profile_id, false;
    return;
  end if;

  if v_application.profile_id is null then
    update public.organizer_applications oa
    set profile_id = v_profile_id
    where oa.id = v_application.id
      and oa.profile_id is null;
  end if;

  update public.profiles p
  set role = 'organizer',
      approved_at = coalesce(p.approved_at, now()),
      full_name = case
        when nullif(btrim(p.full_name), '') is null and nullif(btrim(v_application.applicant_full_name), '') is not null
          then btrim(v_application.applicant_full_name)
        else p.full_name
      end,
      organization = case
        when nullif(btrim(p.organization), '') is null and nullif(btrim(v_application.organization_name), '') is not null
          then btrim(v_application.organization_name)
        else p.organization
      end,
      updated_at = now()
  where p.id = v_profile_id;

  v_activated := true;

  return query
    select 'ok', v_application.id, v_profile_id, v_activated;
end;
$$;

create or replace function public.archive_competition(
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
  v_has_active_attempts boolean := false;
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
  from public.competitions c
  where c.id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object('request_idempotency_token', v_token);
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:archive:'
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
    and ce.control_action = 'archive_competition'
    and coalesce(ce.actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ce.request_idempotency_token = v_token
  order by ce.happened_at desc, ce.id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_archived'
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

  if v_competition.status = 'ended'::public.competition_status then
    null;
  elsif v_competition.status = 'paused'::public.competition_status then
    if v_competition.type <> 'open'::public.competition_type then
      return query
        select 'archive_requires_open_paused_competition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if to_regclass('public.competition_attempts') is not null then
      execute
        'select exists (
           select 1
           from public.competition_attempts ca
           where ca.competition_id = $1
             and ca.status = ''in_progress''
         )'
      into v_has_active_attempts
      using p_competition_id;
    end if;

    if v_has_active_attempts then
      return query
        select 'archive_requires_no_active_attempts', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;
  else
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions c
  set status = 'archived'::public.competition_status,
      updated_at = now()
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
    'competition_archived',
    v_actor_user_id,
    'archive_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'archived',
      'target_status', 'archived'
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;

create or replace function public.resume_competition_attempt(
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_request_idempotency_token text
)
returns table (
  machine_code text,
  attempt_id uuid,
  remaining_seconds integer,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_caller_id uuid := p_actor_user_id;
  v_registration public.competition_registrations%rowtype;
  v_remaining integer;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, null::integer, false;
    return;
  end if;

  if p_attempt_id is null then
    return query
      select 'attempt_id_required'::text, null::uuid, null::integer, false;
    return;
  end if;

  if v_token = '' then
    return query
      select 'request_idempotency_token_required'::text, null::uuid, null::integer, false;
    return;
  end if;

  if v_caller_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, null::integer, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:resume_attempt:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id
  for update;

  if not found then
    return query
      select 'attempt_not_found'::text, null::uuid, null::integer, false;
    return;
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return query
      select 'attempt_not_in_progress'::text, p_attempt_id, null::integer, false;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations cr
  where cr.id = v_attempt.registration_id;

  if v_registration.team_id is not null then
    if not exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = v_registration.team_id
        and tm.profile_id = v_caller_id
        and tm.is_active = true
        and tm.role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, p_attempt_id, null::integer, false;
      return;
    end if;
  end if;

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  if v_remaining <= 0 then
    update public.attempt_intervals ai
    set ended_at = now()
    where ai.attempt_id = p_attempt_id
      and ai.ended_at is null;

    update public.competition_attempts ca
    set status = 'auto_submitted'::public.attempt_status,
        submitted_at = now(),
        total_time_seconds = coalesce((
          select sum(extract(epoch from (coalesce(ai.ended_at, now()) - ai.started_at)))::integer
          from public.attempt_intervals ai
          where ai.attempt_id = p_attempt_id
        ), 0)
    where ca.id = p_attempt_id;

    perform public.grade_attempt(p_attempt_id);

    return query
      select 'auto_submitted'::text, p_attempt_id, 0::integer, false;
    return;
  end if;

  update public.attempt_intervals ai
  set ended_at = now()
  where ai.attempt_id = p_attempt_id
    and ai.ended_at is null;

  insert into public.attempt_intervals (attempt_id, started_at)
  values (p_attempt_id, now());

  return query
    select 'ok'::text, p_attempt_id, v_remaining, false;
end;
$$;

commit;
