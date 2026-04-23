begin;

do $$
begin
  create type public.registration_status as enum ('registered', 'withdrawn', 'ineligible', 'cancelled');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.competition_registrations (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  team_id uuid references public.teams (id) on delete cascade,
  status public.registration_status not null default 'registered',
  status_reason text,
  entry_snapshot_json jsonb not null default '{}'::jsonb,
  registered_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_registrations_actor_chk'
      and conrelid = 'public.competition_registrations'::regclass
  ) then
    alter table public.competition_registrations
      add constraint competition_registrations_actor_chk
      check ((profile_id is null) <> (team_id is null)) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_registrations_snapshot_json_chk'
      and conrelid = 'public.competition_registrations'::regclass
  ) then
    alter table public.competition_registrations
      add constraint competition_registrations_snapshot_json_chk
      check (jsonb_typeof(entry_snapshot_json) = 'object') not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_registrations_status_reason_chk'
      and conrelid = 'public.competition_registrations'::regclass
  ) then
    alter table public.competition_registrations
      add constraint competition_registrations_status_reason_chk
      check (
        status = 'registered'::public.registration_status
        or nullif(btrim(status_reason), '') is not null
      ) not valid;
  end if;
end
$$;

create unique index if not exists competition_registrations_individual_uq
  on public.competition_registrations (competition_id, profile_id)
  where profile_id is not null;

create unique index if not exists competition_registrations_team_uq
  on public.competition_registrations (competition_id, team_id)
  where team_id is not null;

create index if not exists competition_registrations_competition_status_idx
  on public.competition_registrations (competition_id, status);

create index if not exists competition_registrations_profile_status_idx
  on public.competition_registrations (profile_id, status)
  where profile_id is not null;

create index if not exists competition_registrations_team_status_idx
  on public.competition_registrations (team_id, status)
  where team_id is not null;

create or replace function public.competition_registrations_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.competition_registration_snapshot_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;

  if new.entry_snapshot_json is distinct from old.entry_snapshot_json then
    if not (
      old.status in (
        'withdrawn'::public.registration_status,
        'ineligible'::public.registration_status
      )
      and new.status = 'registered'::public.registration_status
    ) then
      raise exception 'registration_snapshot_immutable';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_10_competition_registrations_set_updated_at
  on public.competition_registrations;

create trigger trg_10_competition_registrations_set_updated_at
before update on public.competition_registrations
for each row
execute function public.competition_registrations_set_updated_at();

drop trigger if exists trg_10_competition_registrations_snapshot_guard
  on public.competition_registrations;

create trigger trg_10_competition_registrations_snapshot_guard
before update on public.competition_registrations
for each row
execute function public.competition_registration_snapshot_guard();

alter table public.competition_registrations enable row level security;

drop policy if exists "competition_registrations_select_owner" on public.competition_registrations;
create policy "competition_registrations_select_owner"
on public.competition_registrations
for select
using (
  public.jwt_is_admin()
  or profile_id = auth.uid()
  or public.is_active_team_member(team_id, auth.uid())
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

grant select, insert, update, delete on public.competition_registrations to service_role;

create or replace function public.validate_team_registration(
  p_team_id uuid,
  p_competition_id uuid
)
returns table (
  machine_code text,
  team_id uuid,
  competition_id uuid,
  roster_count integer,
  required_count integer,
  conflict boolean,
  eligible boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_competition public.competitions%rowtype;
  v_team public.teams%rowtype;
  v_roster_count integer := 0;
  v_required_count integer := 0;
  v_conflict boolean := false;
  v_incomplete_count integer := 0;
begin
  if v_actor_id is null then
    return query select 'unauthenticated', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if p_team_id is null then
    return query select 'team_id_required', null::uuid, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query select 'competition_id_required', p_team_id, null::uuid, 0, 0, false, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id;

  if not found then
    return query select 'competition_not_found', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if v_competition.format <> 'team'::public.competition_format
     or v_competition.type <> 'scheduled'::public.competition_type then
    return query select 'team_competition_required', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  select *
  into v_team
  from public.teams
  where id = p_team_id;

  if not found then
    return query select 'team_not_found', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if v_team.is_archived then
    return query select 'team_archived', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  if not exists (
    select 1
    from public.team_memberships
    where team_id = p_team_id
      and profile_id = v_actor_id
      and role = 'leader'::public.team_role
      and is_active = true
  ) then
    return query select 'not_team_leader', p_team_id, p_competition_id, 0, 0, false, false;
    return;
  end if;

  select count(*)
  into v_roster_count
  from public.team_memberships
  where team_id = p_team_id
    and is_active = true;

  v_required_count := coalesce(v_competition.participants_per_team, 0);

  if v_roster_count <> v_required_count then
    return query select 'team_size_invalid', p_team_id, p_competition_id, v_roster_count, v_required_count, false, false;
    return;
  end if;

  select count(*)
  into v_incomplete_count
  from public.team_memberships tm
  join public.profiles p on p.id = tm.profile_id
  where tm.team_id = p_team_id
    and tm.is_active = true
    and (
      p.is_active = false
      or nullif(btrim(p.full_name), '') is null
      or nullif(btrim(p.school), '') is null
      or nullif(btrim(p.grade_level), '') is null
    );

  if v_incomplete_count > 0 then
    return query select 'team_member_profile_incomplete', p_team_id, p_competition_id, v_roster_count, v_required_count, false, false;
    return;
  end if;

  select exists (
    select 1
    from public.team_memberships tm
    join public.team_memberships tm_other
      on tm_other.profile_id = tm.profile_id
      and tm_other.is_active = true
      and tm_other.team_id <> p_team_id
    join public.competition_registrations cr
      on cr.team_id = tm_other.team_id
      and cr.competition_id = p_competition_id
      and cr.status = 'registered'::public.registration_status
    where tm.team_id = p_team_id
      and tm.is_active = true
  )
  into v_conflict;

  if v_conflict then
    return query select 'team_member_conflict', p_team_id, p_competition_id, v_roster_count, v_required_count, true, false;
    return;
  end if;

  return query select 'ok', p_team_id, p_competition_id, v_roster_count, v_required_count, false, true;
end;
$$;

create or replace function public.register_for_competition(
  p_competition_id uuid,
  p_team_id uuid default null,
  p_request_idempotency_token text default null
)
returns table (
  machine_code text,
  registration_id uuid,
  status public.registration_status,
  status_reason text,
  entry_snapshot_json jsonb,
  replayed boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_competition public.competitions%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_profile public.profiles%rowtype;
  v_team public.teams%rowtype;
  v_roster_count integer := 0;
  v_required_count integer := 0;
  v_capacity_count integer := 0;
  v_capacity_limit integer := 0;
  v_snapshot jsonb;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_validation record;
begin
  if v_actor_id is null then
    return query select 'unauthenticated', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query select 'competition_id_required', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query select 'competition_not_found', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query select 'competition_deleted', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_competition.status not in (
    'published'::public.competition_status,
    'live'::public.competition_status,
    'paused'::public.competition_status
  ) then
    return query select 'competition_unavailable', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type then
    if v_competition.registration_start is null or v_competition.registration_end is null then
      return query select 'registration_window_missing', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_now < v_competition.registration_start then
      return query select 'registration_not_started', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_now >= v_competition.registration_end then
      return query select 'registration_closed', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_competition.start_time is not null and v_now >= v_competition.start_time then
      return query select 'competition_started', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;
  end if;

  perform pg_advisory_xact_lock(
    hashtext('competition_registration:' || p_competition_id::text)
  );

  if p_team_id is null then
    if v_competition.format <> 'individual'::public.competition_format then
      return query select 'team_required', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    select *
    into v_profile
    from public.profiles
    where id = v_actor_id;

    if not found then
      return query select 'profile_not_found', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if v_profile.is_active = false then
      return query select 'profile_inactive', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    if nullif(btrim(v_profile.full_name), '') is null
       or nullif(btrim(v_profile.school), '') is null
       or nullif(btrim(v_profile.grade_level), '') is null then
      return query select 'profile_incomplete', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    select *
    into v_registration
    from public.competition_registrations
    where competition_id = p_competition_id
      and profile_id = v_actor_id
    for update;

    if found then
      if v_registration.status = 'registered'::public.registration_status then
        return query select 'already_registered', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, true, false;
        return;
      end if;

      if v_registration.status = 'cancelled'::public.registration_status then
        return query select 'registration_cancelled', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, false;
        return;
      end if;
    end if;

    select count(*)
    into v_capacity_count
    from public.competition_registrations
    where competition_id = p_competition_id
      and status = 'registered'::public.registration_status;

    v_capacity_limit := coalesce(v_competition.max_participants, 0);

    if v_capacity_limit > 0 and v_capacity_count >= v_capacity_limit then
      return query select 'capacity_full', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
      return;
    end if;

    v_snapshot := jsonb_build_object(
      'profile_id', v_profile.id,
      'full_name', v_profile.full_name,
      'school', v_profile.school,
      'grade_level', v_profile.grade_level,
      'registered_at', v_now
    );

    if found then
      update public.competition_registrations
      set status = 'registered'::public.registration_status,
          status_reason = null,
          entry_snapshot_json = v_snapshot,
          registered_at = v_now,
          updated_at = v_now
      where id = v_registration.id
      returning *
      into v_registration;

      return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
      return;
    end if;

    insert into public.competition_registrations (
      competition_id,
      profile_id,
      team_id,
      status,
      status_reason,
      entry_snapshot_json,
      registered_at,
      updated_at
    )
    values (
      p_competition_id,
      v_actor_id,
      null,
      'registered'::public.registration_status,
      null,
      v_snapshot,
      v_now,
      v_now
    )
    returning *
    into v_registration;

    return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
    return;
  end if;

  if v_competition.format <> 'team'::public.competition_format
     or v_competition.type <> 'scheduled'::public.competition_type then
    return query select 'team_registration_not_allowed', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  select *
  into v_team
  from public.teams
  where id = p_team_id;

  if not found then
    return query select 'team_not_found', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if v_team.is_archived then
    return query select 'team_archived', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  if not exists (
    select 1
    from public.team_memberships
    where team_id = p_team_id
      and profile_id = v_actor_id
      and role = 'leader'::public.team_role
      and is_active = true
  ) then
    return query select 'not_team_leader', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where competition_id = p_competition_id
    and team_id = p_team_id
  for update;

  select *
  into v_validation
  from public.validate_team_registration(p_team_id, p_competition_id)
  limit 1;

  if v_validation.machine_code is distinct from 'ok' then
    v_snapshot := jsonb_build_object(
      'team_id', v_team.id,
      'team_name', v_team.name,
      'team_code', v_team.team_code,
      'registered_at', v_now,
      'roster', (
        select coalesce(
          jsonb_agg(
            jsonb_build_object(
              'profile_id', p.id,
              'full_name', p.full_name,
              'school', p.school,
              'grade_level', p.grade_level,
              'role', tm.role
            )
            order by tm.joined_at asc, tm.id asc
          ),
          '[]'::jsonb
        )
        from public.team_memberships tm
        join public.profiles p on p.id = tm.profile_id
        where tm.team_id = p_team_id
          and tm.is_active = true
      )
    );

    if found then
      if v_registration.status = 'ineligible'::public.registration_status
         and v_registration.status_reason = v_validation.machine_code then
        return query select 'ineligible', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, true, false;
        return;
      end if;

      update public.competition_registrations
      set status = 'ineligible'::public.registration_status,
          status_reason = v_validation.machine_code,
          entry_snapshot_json = v_snapshot,
          registered_at = v_now,
          updated_at = v_now
      where id = v_registration.id
      returning *
      into v_registration;

      return query select 'ineligible', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
      return;
    end if;

    insert into public.competition_registrations (
      competition_id,
      profile_id,
      team_id,
      status,
      status_reason,
      entry_snapshot_json,
      registered_at,
      updated_at
    )
    values (
      p_competition_id,
      null,
      p_team_id,
      'ineligible'::public.registration_status,
      v_validation.machine_code,
      v_snapshot,
      v_now,
      v_now
    )
    returning *
    into v_registration;

    return query select 'ineligible', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
    return;
  end if;

  if found then
    if v_registration.status = 'registered'::public.registration_status then
      return query select 'already_registered', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, true, false;
      return;
    end if;

    if v_registration.status = 'cancelled'::public.registration_status then
      return query select 'registration_cancelled', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, false;
      return;
    end if;
  end if;

  select count(*)
  into v_capacity_count
  from public.competition_registrations
  where competition_id = p_competition_id
    and status = 'registered'::public.registration_status;

  v_capacity_limit := coalesce(v_competition.max_teams, 0);

  if v_capacity_limit > 0 and v_capacity_count >= v_capacity_limit then
    return query select 'capacity_full', null::uuid, null::public.registration_status, null::text, null::jsonb, false, false;
    return;
  end if;

  v_snapshot := jsonb_build_object(
    'team_id', v_team.id,
    'team_name', v_team.name,
    'team_code', v_team.team_code,
    'registered_at', v_now,
    'roster', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'profile_id', p.id,
            'full_name', p.full_name,
            'school', p.school,
            'grade_level', p.grade_level,
            'role', tm.role
          )
          order by tm.joined_at asc, tm.id asc
        ),
        '[]'::jsonb
      )
      from public.team_memberships tm
      join public.profiles p on p.id = tm.profile_id
      where tm.team_id = p_team_id
        and tm.is_active = true
    )
  );

  if found then
    update public.competition_registrations
    set status = 'registered'::public.registration_status,
        status_reason = null,
        entry_snapshot_json = v_snapshot,
        registered_at = v_now,
        updated_at = v_now
    where id = v_registration.id
    returning *
    into v_registration;

    return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
    return;
  end if;

  insert into public.competition_registrations (
    competition_id,
    profile_id,
    team_id,
    status,
    status_reason,
    entry_snapshot_json,
    registered_at,
    updated_at
  )
  values (
    p_competition_id,
    null,
    p_team_id,
    'registered'::public.registration_status,
    null,
    v_snapshot,
    v_now,
    v_now
  )
  returning *
  into v_registration;

  return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, v_registration.entry_snapshot_json, false, true;
end;
$$;

create or replace function public.withdraw_registration(
  p_registration_id uuid,
  p_status_reason text,
  p_request_idempotency_token text default null
)
returns table (
  machine_code text,
  registration_id uuid,
  status public.registration_status,
  status_reason text,
  replayed boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := timezone('utc', now());
  v_reason text := nullif(btrim(coalesce(p_status_reason, '')), '');
  v_registration public.competition_registrations%rowtype;
  v_competition public.competitions%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_attempt_exists boolean := false;
begin
  if v_actor_id is null then
    return query select 'unauthenticated', null::uuid, null::public.registration_status, null::text, false, false;
    return;
  end if;

  if p_registration_id is null then
    return query select 'registration_id_required', null::uuid, null::public.registration_status, null::text, false, false;
    return;
  end if;

  if v_token = '' then
    return query select 'request_idempotency_token_required', null::uuid, null::public.registration_status, null::text, false, false;
    return;
  end if;

  if v_reason is null then
    return query select 'status_reason_required', null::uuid, null::public.registration_status, null::text, false, false;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations
  where id = p_registration_id
  for update;

  if not found then
    return query select 'not_found', null::uuid, null::public.registration_status, null::text, false, false;
    return;
  end if;

  if v_registration.profile_id is not null then
    if v_registration.profile_id <> v_actor_id then
      return query select 'forbidden', v_registration.id, v_registration.status, v_registration.status_reason, false, false;
      return;
    end if;
  else
    if not exists (
      select 1
      from public.team_memberships
      where team_id = v_registration.team_id
        and profile_id = v_actor_id
        and role = 'leader'::public.team_role
        and is_active = true
    ) then
      return query select 'forbidden', v_registration.id, v_registration.status, v_registration.status_reason, false, false;
      return;
    end if;
  end if;

  if v_registration.status = 'withdrawn'::public.registration_status then
    return query select 'already_withdrawn', v_registration.id, v_registration.status, v_registration.status_reason, true, false;
    return;
  end if;

  if v_registration.status <> 'registered'::public.registration_status then
    return query select 'invalid_status', v_registration.id, v_registration.status, v_registration.status_reason, false, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = v_registration.competition_id;

  if not found then
    return query select 'competition_not_found', v_registration.id, v_registration.status, v_registration.status_reason, false, false;
    return;
  end if;

  if v_competition.type = 'scheduled'::public.competition_type
     and v_competition.start_time is not null
     and v_now >= v_competition.start_time then
    return query select 'withdrawal_after_start', v_registration.id, v_registration.status, v_registration.status_reason, false, false;
    return;
  end if;

  if to_regclass('public.competition_attempts') is not null then
    execute
      'select exists (
         select 1
         from public.competition_attempts
         where registration_id = $1
       )'
    into v_attempt_exists
    using v_registration.id;

    if v_attempt_exists then
      return query select 'attempts_exist', v_registration.id, v_registration.status, v_registration.status_reason, false, false;
      return;
    end if;
  end if;

  update public.competition_registrations
  set status = 'withdrawn'::public.registration_status,
      status_reason = v_reason,
      updated_at = v_now
  where id = v_registration.id
  returning *
  into v_registration;

  return query select 'ok', v_registration.id, v_registration.status, v_registration.status_reason, false, true;
end;
$$;

grant execute on function public.register_for_competition(uuid, uuid, text) to authenticated, service_role;
grant execute on function public.withdraw_registration(uuid, text, text) to authenticated, service_role;
grant execute on function public.validate_team_registration(uuid, uuid) to authenticated, service_role;

commit;
