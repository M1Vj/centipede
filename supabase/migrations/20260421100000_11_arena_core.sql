begin;

-- ============================================================================
-- Branch 11-A: Arena Core
-- Tables: competition_registrations, competition_attempts, attempt_intervals, attempt_answers
-- RPCs: register_for_competition, start_competition_attempt, resume_competition_attempt,
--       close_active_attempt_interval, save_attempt_answer, submit_competition_attempt,
--       get_attempt_remaining_seconds
-- ============================================================================

-- Enums
do $$ begin
  create type public.registration_status as enum (
    'registered',
    'withdrawn',
    'ineligible',
    'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.attempt_status as enum (
    'in_progress',
    'submitted',
    'auto_submitted',
    'disqualified',
    'graded'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.answer_status_flag as enum (
    'blank',
    'filled',
    'solved',
    'reset'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.competition_problems
  add column if not exists problem_type_snapshot public.problem_type;

update public.competition_problems cp
set problem_type_snapshot = coalesce(cp.problem_type_snapshot, p.type)
from public.problems p
where cp.problem_id = p.id
  and cp.problem_type_snapshot is null;

-- ============================================================================
-- Table: competition_registrations (pull-forward from branch 10)
-- ============================================================================

create table if not exists public.competition_registrations (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id),
  profile_id uuid references public.profiles (id),
  team_id uuid references public.teams (id),
  status public.registration_status not null default 'registered',
  status_reason text,
  entry_snapshot_json jsonb,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_registrations_participant_xor_chk'
      and conrelid = 'public.competition_registrations'::regclass
  ) then
    alter table public.competition_registrations
      add constraint competition_registrations_participant_xor_chk
      check ((profile_id is not null) != (team_id is not null)) not valid;
  end if;
end;
$$;

create unique index if not exists competition_registrations_profile_uq
  on public.competition_registrations (competition_id, profile_id)
  where profile_id is not null;

create unique index if not exists competition_registrations_team_uq
  on public.competition_registrations (competition_id, team_id)
  where team_id is not null;

create index if not exists competition_registrations_status_idx
  on public.competition_registrations (competition_id, status);

create index if not exists competition_registrations_profile_idx
  on public.competition_registrations (profile_id)
  where profile_id is not null;

create index if not exists competition_registrations_team_idx
  on public.competition_registrations (team_id)
  where team_id is not null;

alter table public.competition_registrations enable row level security;

drop policy if exists "competition_registrations_select_participant" on public.competition_registrations;
create policy "competition_registrations_select_participant"
on public.competition_registrations
for select
using (
  public.jwt_is_admin()
  or profile_id = auth.uid()
  or (team_id is not null and public.is_active_team_member(team_id, auth.uid()))
  or exists (
    select 1
    from public.competitions c
    where c.id = competition_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "competition_registrations_service_write" on public.competition_registrations;
create policy "competition_registrations_service_write"
on public.competition_registrations
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- ============================================================================
-- Table: competition_attempts
-- ============================================================================

create table if not exists public.competition_attempts (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id),
  registration_id uuid not null references public.competition_registrations (id),
  attempt_no integer not null,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  graded_at timestamptz,
  raw_score numeric not null default 0,
  penalty_score numeric not null default 0,
  final_score numeric not null default 0,
  total_time_seconds integer not null default 0,
  offense_count integer not null default 0,
  is_latest_visible_result boolean not null default false,
  grade_summary_json jsonb,
  attempt_base_deadline_at timestamptz,
  scheduled_competition_end_cap_at timestamptz,
  effective_attempt_deadline_at timestamptz
);

create unique index if not exists competition_attempts_registration_no_uq
  on public.competition_attempts (registration_id, attempt_no);

create index if not exists competition_attempts_competition_status_idx
  on public.competition_attempts (competition_id, status);

create index if not exists competition_attempts_registration_idx
  on public.competition_attempts (registration_id, attempt_no);

alter table public.competition_attempts enable row level security;

drop policy if exists "competition_attempts_select_participant" on public.competition_attempts;
create policy "competition_attempts_select_participant"
on public.competition_attempts
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competition_registrations cr
    where cr.id = registration_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
  or exists (
    select 1
    from public.competitions c
    where c.id = competition_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "competition_attempts_service_write" on public.competition_attempts;
create policy "competition_attempts_service_write"
on public.competition_attempts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- ============================================================================
-- Table: attempt_intervals
-- ============================================================================

create table if not exists public.attempt_intervals (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.competition_attempts (id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists attempt_intervals_attempt_started_idx
  on public.attempt_intervals (attempt_id, started_at);

alter table public.attempt_intervals enable row level security;

drop policy if exists "attempt_intervals_select_participant" on public.attempt_intervals;
create policy "attempt_intervals_select_participant"
on public.attempt_intervals
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = attempt_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
);

drop policy if exists "attempt_intervals_service_write" on public.attempt_intervals;
create policy "attempt_intervals_service_write"
on public.attempt_intervals
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- ============================================================================
-- Table: attempt_answers
-- ============================================================================

create table if not exists public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.competition_attempts (id),
  competition_problem_id uuid not null references public.competition_problems (id),
  answer_latex text not null default '',
  answer_text_normalized text not null default '',
  status_flag public.answer_status_flag not null default 'blank',
  is_correct boolean,
  points_awarded numeric,
  last_saved_at timestamptz not null default now(),
  client_updated_at timestamptz not null default now()
);

create unique index if not exists attempt_answers_attempt_problem_uq
  on public.attempt_answers (attempt_id, competition_problem_id);

alter table public.attempt_answers enable row level security;

drop policy if exists "attempt_answers_select_participant" on public.attempt_answers;
create policy "attempt_answers_select_participant"
on public.attempt_answers
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = attempt_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competitions c on c.id = ca.competition_id
    where ca.id = attempt_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "attempt_answers_service_write" on public.attempt_answers;
create policy "attempt_answers_service_write"
on public.attempt_answers
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

update public.competition_attempts ca
set attempt_base_deadline_at = coalesce(
      ca.attempt_base_deadline_at,
      ca.started_at + make_interval(mins => coalesce(c.duration_minutes, 0))
    ),
    scheduled_competition_end_cap_at = coalesce(
      ca.scheduled_competition_end_cap_at,
      coalesce(c.end_time, c.start_time + make_interval(mins => coalesce(c.duration_minutes, 0)))
    ),
    effective_attempt_deadline_at = coalesce(
      ca.effective_attempt_deadline_at,
      case
        when c.type = 'scheduled'::public.competition_type then least(
          ca.started_at + make_interval(mins => coalesce(c.duration_minutes, 0)),
          coalesce(c.end_time, c.start_time + make_interval(mins => coalesce(c.duration_minutes, 0)))
        )
        else ca.started_at + make_interval(mins => coalesce(c.duration_minutes, 0))
      end
    )
from public.competitions c
where c.id = ca.competition_id
  and (
    ca.attempt_base_deadline_at is null
    or ca.scheduled_competition_end_cap_at is null
    or ca.effective_attempt_deadline_at is null
  );

update public.attempt_answers
set client_updated_at = coalesce(client_updated_at, last_saved_at, now())
where client_updated_at is null;

-- ============================================================================
-- Trigger: auto-update updated_at on competition_registrations
-- ============================================================================

create or replace function public.competition_registration_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_11_competition_registrations_10_set_updated_at on public.competition_registrations;
create trigger trg_11_competition_registrations_10_set_updated_at
before update on public.competition_registrations
for each row
execute function public.competition_registration_set_updated_at();

-- ============================================================================
-- RPC: register_for_competition
-- ============================================================================

create or replace function public.register_for_competition(
  p_competition_id uuid,
  p_actor_user_id uuid,
  p_team_id uuid default null
)
returns table (
  machine_code text,
  registration_id uuid,
  competition_id uuid,
  status public.registration_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_profile public.profiles%rowtype;
  v_caller_id uuid := p_actor_user_id;
  v_registration public.competition_registrations%rowtype;
  v_entry_snapshot jsonb;
  v_is_team_path boolean := (p_team_id is not null);
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if p_competition_id is null then
    return query
      select 'competition_id_required'::text, null::uuid, null::uuid, null::public.registration_status;
    return;
  end if;

  if v_caller_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id;

  if not found then
    return query
      select 'competition_not_found'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'competition_deleted'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if v_competition.status not in ('published'::public.competition_status, 'live'::public.competition_status) then
    return query
      select 'competition_not_open_for_registration'::text, null::uuid, p_competition_id, null::public.registration_status;
    return;
  end if;

  if v_is_team_path then
    if v_competition.format <> 'team'::public.competition_format then
      return query
        select 'team_registration_not_allowed'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    if v_competition.type <> 'scheduled'::public.competition_type then
      return query
        select 'team_requires_scheduled_type'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    if not public.is_active_team_member(p_team_id, v_caller_id) then
      return query
        select 'not_active_team_member'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    if not exists (
      select 1
      from public.team_memberships
      where team_id = p_team_id
        and profile_id = v_caller_id
        and is_active = true
        and role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    select *
    into v_registration
    from public.competition_registrations
    where competition_registrations.competition_id = p_competition_id
      and competition_registrations.team_id = p_team_id
    limit 1;

  else
    if v_competition.format <> 'individual'::public.competition_format then
      return query
        select 'individual_registration_not_allowed'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    select *
    into v_profile
    from public.profiles
    where id = v_caller_id;

    if not found then
      return query
        select 'profile_not_found'::text, null::uuid, p_competition_id, null::public.registration_status;
      return;
    end if;

    select *
    into v_registration
    from public.competition_registrations
    where competition_registrations.competition_id = p_competition_id
      and competition_registrations.profile_id = v_caller_id
    limit 1;
  end if;

  if found then
    if v_registration.status = 'registered'::public.registration_status then
      return query
        select 'already_registered'::text, v_registration.id, p_competition_id, v_registration.status;
      return;
    end if;

    if v_registration.status = 'cancelled'::public.registration_status then
      return query
        select 'registration_cancelled'::text, v_registration.id, p_competition_id, v_registration.status;
      return;
    end if;

    if v_registration.status in ('ineligible'::public.registration_status, 'withdrawn'::public.registration_status) then
      if v_is_team_path then
        v_entry_snapshot := jsonb_build_object(
          'team_id', p_team_id,
          'registered_by', v_caller_id,
          're_entry_from', v_registration.status,
          'registered_at', now()
        );
      else
        v_entry_snapshot := jsonb_build_object(
          'profile_id', v_caller_id,
          'display_name', v_profile.display_name,
          're_entry_from', v_registration.status,
          'registered_at', now()
        );
      end if;

      update public.competition_registrations
      set status = 'registered'::public.registration_status,
          status_reason = null,
          entry_snapshot_json = v_entry_snapshot,
          updated_at = now()
      where id = v_registration.id
      returning * into v_registration;

      return query
        select 'ok'::text, v_registration.id, p_competition_id, v_registration.status;
      return;
    end if;

    return query
      select 'invalid_existing_status'::text, v_registration.id, p_competition_id, v_registration.status;
    return;
  end if;

  if v_is_team_path then
    v_entry_snapshot := jsonb_build_object(
      'team_id', p_team_id,
      'registered_by', v_caller_id,
      'registered_at', now()
    );

    insert into public.competition_registrations (
      competition_id, profile_id, team_id, status, entry_snapshot_json
    )
    values (
      p_competition_id, null, p_team_id, 'registered', v_entry_snapshot
    )
    returning * into v_registration;
  else
    v_entry_snapshot := jsonb_build_object(
      'profile_id', v_caller_id,
      'display_name', v_profile.display_name,
      'registered_at', now()
    );

    insert into public.competition_registrations (
      competition_id, profile_id, team_id, status, entry_snapshot_json
    )
    values (
      p_competition_id, v_caller_id, null, 'registered', v_entry_snapshot
    )
    returning * into v_registration;
  end if;

  return query
    select 'ok'::text, v_registration.id, p_competition_id, v_registration.status;
end;
$$;

-- ============================================================================
-- RPC: start_competition_attempt
-- ============================================================================

create or replace function public.start_competition_attempt(
  p_registration_id uuid,
  p_actor_user_id uuid,
  p_request_idempotency_token text
)
returns table (
  machine_code text,
  attempt_id uuid,
  competition_id uuid,
  attempt_no integer,
  remaining_seconds integer,
  started_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_registration public.competition_registrations%rowtype;
  v_competition public.competitions%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_caller_id uuid := p_actor_user_id;
  v_attempt public.competition_attempts%rowtype;
  v_existing_attempt public.competition_attempts%rowtype;
  v_attempt_count integer;
  v_attempt_no integer;
  v_remaining integer;
  v_attempt_base_deadline_at timestamptz;
  v_scheduled_competition_end_cap_at timestamptz;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if p_registration_id is null then
    return query
      select 'registration_id_required'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_token = '' then
    return query
      select 'request_idempotency_token_required'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_caller_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where id = p_registration_id
  for update;

  if not found then
    return query
      select 'registration_not_found'::text, null::uuid, null::uuid, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_registration.status <> 'registered'::public.registration_status then
    return query
      select 'registration_not_active'::text, null::uuid, v_registration.competition_id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = v_registration.competition_id;

  if not found then
    return query
      select 'competition_not_found'::text, null::uuid, v_registration.competition_id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'competition_deleted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type then
    if v_competition.status <> 'live'::public.competition_status then
      return query
        select 'competition_not_live'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;

    if v_competition.start_time is not null and now() < v_competition.start_time then
      return query
        select 'competition_not_started_yet'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;
  else
    if v_competition.status not in ('published'::public.competition_status, 'live'::public.competition_status) then
      return query
        select 'competition_not_available'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;
  end if;

  if v_registration.team_id is not null then
    if not exists (
      select 1
      from public.team_memberships
      where team_id = v_registration.team_id
        and profile_id = v_caller_id
        and is_active = true
        and role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
      return;
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:start_attempt:registration:' || p_registration_id::text));

  select *
  into v_existing_attempt
  from public.competition_attempts
  where registration_id = p_registration_id
    and status = 'in_progress'::public.attempt_status
  order by started_at desc, id desc
  limit 1;

  if found then
    v_remaining := greatest(
      0,
      extract(epoch from (coalesce(v_existing_attempt.effective_attempt_deadline_at, v_existing_attempt.started_at) - now()))::integer
    );

    return query
      select 'ok'::text, v_existing_attempt.id, v_competition.id, v_existing_attempt.attempt_no, v_remaining, v_existing_attempt.started_at, true;
    return;
  end if;

  select count(*)
  into v_attempt_count
  from public.competition_attempts
  where registration_id = p_registration_id;

  if v_attempt_count >= coalesce(v_competition.attempts_allowed, 1) then
    return query
      select 'attempts_exhausted'::text, null::uuid, v_competition.id, null::integer, null::integer, null::timestamptz, false;
    return;
  end if;

  v_attempt_no := v_attempt_count + 1;

  v_attempt_base_deadline_at :=
    now() + make_interval(mins => coalesce(v_competition.duration_minutes, 0));
  v_scheduled_competition_end_cap_at :=
    coalesce(
      v_competition.end_time,
      v_competition.start_time + make_interval(mins => coalesce(v_competition.duration_minutes, 0))
    );

  insert into public.competition_attempts (
    competition_id,
    registration_id,
    attempt_no,
    status,
    started_at,
    attempt_base_deadline_at,
    scheduled_competition_end_cap_at,
    effective_attempt_deadline_at
  )
  values (
    v_competition.id,
    p_registration_id,
    v_attempt_no,
    'in_progress',
    now(),
    v_attempt_base_deadline_at,
    v_scheduled_competition_end_cap_at,
    case
      when v_competition.type = 'scheduled'::public.competition_type then least(
        v_attempt_base_deadline_at,
        v_scheduled_competition_end_cap_at
      )
      else v_attempt_base_deadline_at
    end
  )
  returning * into v_attempt;

  insert into public.attempt_answers (attempt_id, competition_problem_id, status_flag)
  select v_attempt.id, cp.id, 'blank'::public.answer_status_flag
  from public.competition_problems cp
  where cp.competition_id = v_competition.id
  order by cp.order_index;

  insert into public.attempt_intervals (attempt_id, started_at)
  values (v_attempt.id, now());

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  return query
    select 'ok'::text, v_attempt.id, v_competition.id, v_attempt.attempt_no, v_remaining, v_attempt.started_at, false;
end;
$$;

-- ============================================================================
-- RPC: resume_competition_attempt
-- ============================================================================

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
  from public.competition_attempts
  where id = p_attempt_id
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
  from public.competition_registrations
  where id = v_attempt.registration_id;

  if v_registration.team_id is not null then
    if not exists (
      select 1
      from public.team_memberships
      where team_id = v_registration.team_id
        and profile_id = v_caller_id
        and is_active = true
        and role = 'leader'
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
    update public.attempt_intervals
    set ended_at = now()
    where attempt_id = p_attempt_id
      and ended_at is null;

    update public.competition_attempts
    set status = 'auto_submitted'::public.attempt_status,
        submitted_at = now(),
        total_time_seconds = coalesce((
          select sum(extract(epoch from (coalesce(ai.ended_at, now()) - ai.started_at)))::integer
          from public.attempt_intervals ai
          where ai.attempt_id = p_attempt_id
        ), 0)
    where id = p_attempt_id;

    perform public.grade_attempt(p_attempt_id);

    return query
      select 'auto_submitted'::text, p_attempt_id, 0::integer, false;
    return;
  end if;

  update public.attempt_intervals
  set ended_at = now()
  where attempt_id = p_attempt_id
    and ended_at is null;

  insert into public.attempt_intervals (attempt_id, started_at)
  values (p_attempt_id, now());

  return query
    select 'ok'::text, p_attempt_id, v_remaining, false;
end;
$$;

-- ============================================================================
-- RPC: close_active_attempt_interval
-- ============================================================================

create or replace function public.close_active_attempt_interval(
  p_attempt_id uuid,
  p_actor_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_closed_count integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted arena flows may execute close_active_attempt_interval.';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required.';
  end if;

  if p_actor_user_id is null then
    raise exception 'actor_user_id is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:close_interval:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt_not_found';
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where id = v_attempt.registration_id;

  if v_registration.profile_id is not null and v_registration.profile_id <> p_actor_user_id then
    raise exception 'forbidden';
  end if;

  if v_registration.team_id is not null and not exists (
    select 1
    from public.team_memberships
    where team_id = v_registration.team_id
      and profile_id = p_actor_user_id
      and is_active = true
      and role = 'leader'
  ) then
    raise exception 'forbidden';
  end if;

  update public.attempt_intervals
  set ended_at = now()
  where attempt_id = p_attempt_id
    and ended_at is null;

  get diagnostics v_closed_count = row_count;

  return v_closed_count;
end;
$$;

-- ============================================================================
-- RPC: save_attempt_answer
-- ============================================================================

create or replace function public.save_attempt_answer(
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_competition_problem_id uuid,
  p_answer_latex text,
  p_answer_text_normalized text,
  p_status_flag public.answer_status_flag,
  p_client_updated_at timestamptz
)
returns table (
  machine_code text,
  answer_id uuid,
  last_saved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_remaining integer;
  v_answer public.attempt_answers%rowtype;
  v_now timestamptz := now();
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_attempt_id is null then
    return query
      select 'attempt_id_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_competition_problem_id is null then
    return query
      select 'competition_problem_id_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_actor_user_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if p_client_updated_at is null then
    return query
      select 'client_updated_at_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:save_answer:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return query
      select 'attempt_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return query
      select 'attempt_not_in_progress'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where id = v_attempt.registration_id;

  if not found then
    return query
      select 'registration_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_registration.profile_id is not null and v_registration.profile_id <> p_actor_user_id then
    return query
      select 'forbidden'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_registration.team_id is not null and not exists (
    select 1
    from public.team_memberships
    where team_id = v_registration.team_id
      and profile_id = p_actor_user_id
      and is_active = true
      and role = 'leader'
  ) then
    return query
      select 'team_leader_required'::text, null::uuid, null::timestamptz;
    return;
  end if;

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  if v_remaining <= 0 then
    return query
      select 'deadline_passed'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1
    from public.competition_problems
    where id = p_competition_problem_id
      and competition_id = v_attempt.competition_id
  ) then
    return query
      select 'competition_problem_not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.attempt_answers (
    attempt_id,
    competition_problem_id,
    answer_latex,
    answer_text_normalized,
    status_flag,
    last_saved_at,
    client_updated_at
  )
  values (
    p_attempt_id,
    p_competition_problem_id,
    coalesce(p_answer_latex, ''),
    coalesce(p_answer_text_normalized, ''),
    coalesce(p_status_flag, 'filled'::public.answer_status_flag),
    v_now,
    p_client_updated_at
  )
  on conflict (attempt_id, competition_problem_id)
  do update set
    answer_latex = coalesce(excluded.answer_latex, attempt_answers.answer_latex),
    answer_text_normalized = coalesce(excluded.answer_text_normalized, attempt_answers.answer_text_normalized),
    status_flag = excluded.status_flag,
    last_saved_at = excluded.last_saved_at,
    client_updated_at = excluded.client_updated_at
  where attempt_answers.client_updated_at < excluded.client_updated_at
  returning * into v_answer;

  if not found then
    select *
    into v_answer
    from public.attempt_answers
    where attempt_id = p_attempt_id
      and competition_problem_id = p_competition_problem_id;

    return query
      select 'answer_write_conflict'::text, v_answer.id, v_answer.last_saved_at;
    return;
  end if;

  return query
    select 'ok'::text, v_answer.id, v_answer.last_saved_at;
end;
$$;

-- ============================================================================
-- RPC: submit_competition_attempt
-- ============================================================================

create or replace function public.submit_competition_attempt(
  p_attempt_id uuid,
  p_actor_user_id uuid,
  p_request_idempotency_token text,
  p_submission_kind text default 'manual'
)
returns table (
  machine_code text,
  attempt_id uuid,
  status public.attempt_status,
  submitted_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_competition public.competitions%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_caller_id uuid := p_actor_user_id;
  v_total_time integer;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_attempt_id is null then
    return query
      select 'attempt_id_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if v_token = '' then
    return query
      select 'request_idempotency_token_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind not in ('manual', 'auto') then
    return query
      select 'invalid_submission_kind'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind = 'manual' and v_caller_id is null then
    return query
      select 'actor_user_id_required'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:submit_attempt:attempt:' || p_attempt_id::text));

  select *
  into v_attempt
  from public.competition_attempts
  where id = p_attempt_id
  for update;

  if not found then
    return query
      select 'attempt_not_found'::text, null::uuid, null::public.attempt_status, null::timestamptz, false;
    return;
  end if;

  if v_attempt.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status) then
    return query
      select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, true;
    return;
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    return query
      select 'attempt_not_in_progress'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = v_attempt.competition_id;

  select *
  into v_registration
  from public.competition_registrations
  where id = v_attempt.registration_id;

  if p_submission_kind = 'manual' and v_registration.profile_id is not null and v_registration.profile_id <> v_caller_id then
    return query
      select 'forbidden'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
    return;
  end if;

  if p_submission_kind = 'manual' and v_registration.team_id is not null then
    if not exists (
      select 1
      from public.team_memberships
      where team_id = v_registration.team_id
        and profile_id = v_caller_id
        and is_active = true
        and role = 'leader'
    ) then
      return query
        select 'team_leader_required'::text, p_attempt_id, v_attempt.status, null::timestamptz, false;
      return;
    end if;
  end if;

  update public.attempt_intervals
  set ended_at = now()
  where attempt_id = p_attempt_id
    and ended_at is null;

  select coalesce(sum(extract(epoch from (coalesce(ai.ended_at, now()) - ai.started_at)))::integer, 0)
  into v_total_time
  from public.attempt_intervals ai
  where ai.attempt_id = p_attempt_id;

  update public.competition_attempts
  set status = case
        when p_submission_kind = 'auto' then 'auto_submitted'::public.attempt_status
        else 'submitted'::public.attempt_status
      end,
      submitted_at = now(),
      total_time_seconds = v_total_time
  where id = p_attempt_id
  returning * into v_attempt;

  perform public.grade_attempt(p_attempt_id);

  update public.competition_attempts
  set is_latest_visible_result = (id = (
    select ca2.id
    from public.competition_attempts ca2
    where ca2.registration_id = v_attempt.registration_id
      and ca2.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status)
    order by
      case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
        when 'highest_score'::public.attempt_grading_mode then ca2.final_score
        else 0
      end desc,
      case coalesce(v_competition.multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode)
        when 'latest_score'::public.attempt_grading_mode then ca2.attempt_no
        else 0
      end desc,
      ca2.attempt_no desc
    limit 1
  ))
  where registration_id = v_attempt.registration_id
    and status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status, 'graded'::public.attempt_status);

  return query
    select 'ok'::text, p_attempt_id, v_attempt.status, v_attempt.submitted_at, false;
end;
$$;

-- ============================================================================
-- RPC: get_attempt_remaining_seconds
-- ============================================================================

create or replace function public.get_attempt_remaining_seconds(
  p_attempt_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_remaining integer;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted arena flows may execute get_attempt_remaining_seconds.';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required.';
  end if;

  select *
  into v_attempt
  from public.competition_attempts
  where id = p_attempt_id;

  if not found then
    return 0;
  end if;

  v_remaining := greatest(
    0,
    extract(epoch from (coalesce(v_attempt.effective_attempt_deadline_at, v_attempt.started_at) - now()))::integer
  );

  return v_remaining;
end;
$$;

-- ============================================================================
-- Grants
-- ============================================================================

revoke all on function public.register_for_competition(uuid, uuid, uuid) from public;
revoke all on function public.start_competition_attempt(uuid, uuid, text) from public;
revoke all on function public.resume_competition_attempt(uuid, uuid, text) from public;
revoke all on function public.close_active_attempt_interval(uuid, uuid) from public;
revoke all on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) from public;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from public;
revoke all on function public.get_attempt_remaining_seconds(uuid) from public;
revoke all on function public.register_for_competition(uuid, uuid, uuid) from anon, authenticated;
revoke all on function public.start_competition_attempt(uuid, uuid, text) from anon, authenticated;
revoke all on function public.resume_competition_attempt(uuid, uuid, text) from anon, authenticated;
revoke all on function public.close_active_attempt_interval(uuid, uuid) from anon, authenticated;
revoke all on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) from anon, authenticated;
revoke all on function public.submit_competition_attempt(uuid, uuid, text, text) from anon, authenticated;
revoke all on function public.get_attempt_remaining_seconds(uuid) from anon, authenticated;

grant execute on function public.register_for_competition(uuid, uuid, uuid) to service_role;
grant execute on function public.start_competition_attempt(uuid, uuid, text) to service_role;
grant execute on function public.resume_competition_attempt(uuid, uuid, text) to service_role;
grant execute on function public.close_active_attempt_interval(uuid, uuid) to service_role;
grant execute on function public.save_attempt_answer(uuid, uuid, uuid, text, text, public.answer_status_flag, timestamptz) to service_role;
grant execute on function public.submit_competition_attempt(uuid, uuid, text, text) to service_role;
grant execute on function public.get_attempt_remaining_seconds(uuid) to service_role;

grant all privileges on public.competition_registrations to service_role;
grant all privileges on public.competition_attempts to service_role;
grant all privileges on public.attempt_intervals to service_role;
grant all privileges on public.attempt_answers to service_role;

do $$
begin
  alter publication supabase_realtime add table public.competition_attempts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.attempt_answers;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

commit;
