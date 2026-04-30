begin;

alter table public.competitions 
  add column if not exists offense_penalties_json jsonb;

-- Ensure offense_penalties_json is an object if not null
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_offense_penalties_json_object_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_offense_penalties_json_object_chk
      check (
        offense_penalties_json is null
        or jsonb_typeof(offense_penalties_json) = 'object'
      ) not valid;
  end if;
end;
$$;

alter table public.competitions validate constraint competitions_offense_penalties_json_object_chk;

create table if not exists public.tab_switch_logs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.competition_attempts (id) on delete cascade,
  offense_number integer not null,
  penalty_applied text not null,
  client_timestamp timestamptz,
  logged_at timestamptz not null default now(),
  metadata_json jsonb not null
);

alter table public.tab_switch_logs enable row level security;

drop policy if exists "tab_switch_logs_organizer_select" on public.tab_switch_logs;
create policy "tab_switch_logs_organizer_select"
on public.tab_switch_logs for select
using (
  exists (
    select 1
    from public.competition_attempts ca
    join public.competitions c on c.id = ca.competition_id
    where ca.id = attempt_id and c.organizer_id = auth.uid()
  )
);

drop policy if exists "tab_switch_logs_admin_select" on public.tab_switch_logs;
create policy "tab_switch_logs_admin_select"
on public.tab_switch_logs for select
using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'admin'
  )
);

drop policy if exists "tab_switch_logs_participant_select" on public.tab_switch_logs;
create policy "tab_switch_logs_participant_select"
on public.tab_switch_logs for select
using (
  exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = attempt_id and (
      cr.participant_id = auth.uid()
      or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
    )
  )
);

drop function if exists public.log_tab_switch_offense(uuid, jsonb);

create or replace function public.log_tab_switch_offense(
  p_attempt_id uuid,
  p_metadata_json jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_id uuid := auth.uid();
  v_attempt public.competition_attempts%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_competition public.competitions%rowtype;
  v_offense_number integer;
  v_penalty_applied text := 'none';
  v_client_timestamp_str text;
  v_client_timestamp timestamptz := null;
  v_penalties jsonb;
  v_warning_threshold integer := 999999;
  v_deduction_threshold integer := 999999;
  v_deduction_value numeric := 0;
  v_auto_submit_threshold integer := 999999;
  v_disqualification_threshold integer := 999999;
begin
  if p_attempt_id is null then
    raise exception 'attempt_id_required';
  end if;

  if p_metadata_json is null or jsonb_typeof(p_metadata_json) <> 'object' then
    raise exception 'metadata_json_object_required';
  end if;

  if not (p_metadata_json ? 'event_source' and p_metadata_json ? 'visibility_state' and p_metadata_json ? 'route_path' and p_metadata_json ? 'user_agent' and p_metadata_json ? 'client_timestamp') then
    raise exception 'metadata_json_missing_keys';
  end if;

  if v_caller_id is null then
    raise exception 'authentication_required';
  end if;

  perform pg_advisory_xact_lock(hashtext('arena:log_offense:attempt:' || p_attempt_id::text));

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

  if v_registration.participant_id is not null and v_registration.participant_id <> v_caller_id then
    raise exception 'forbidden';
  elsif v_registration.team_id is not null and not public.is_active_team_member(v_registration.team_id, v_caller_id) then
    raise exception 'forbidden';
  end if;

  if v_attempt.status <> 'in_progress'::public.attempt_status then
    raise exception 'attempt_not_active';
  end if;

  select *
  into v_competition
  from public.competitions
  where id = v_attempt.competition_id;

  v_client_timestamp_str := p_metadata_json->>'client_timestamp';
  if v_client_timestamp_str is not null then
    begin
      v_client_timestamp := v_client_timestamp_str::timestamptz;
      -- ignore if conversion fails
    exception when others then
      v_client_timestamp := null;
    end;
  end if;

  v_offense_number := v_attempt.offense_count + 1;

  v_penalties := coalesce(v_competition.offense_penalties_json, '{}'::jsonb);
  if v_penalties ? 'warning_threshold' then
    v_warning_threshold := (v_penalties->>'warning_threshold')::integer;
  end if;
  if v_penalties ? 'deduction_threshold' then
    v_deduction_threshold := (v_penalties->>'deduction_threshold')::integer;
  end if;
  if v_penalties ? 'deduction_value' then
    v_deduction_value := (v_penalties->>'deduction_value')::numeric;
  end if;
  if v_penalties ? 'auto_submit_threshold' then
    v_auto_submit_threshold := (v_penalties->>'auto_submit_threshold')::integer;
  end if;
  if v_penalties ? 'disqualification_threshold' then
    v_disqualification_threshold := (v_penalties->>'disqualification_threshold')::integer;
  end if;

  if v_offense_number >= v_disqualification_threshold then
    v_penalty_applied := 'disqualified';
  elsif v_offense_number >= v_auto_submit_threshold then
    v_penalty_applied := 'auto_submit';
  elsif v_offense_number >= v_deduction_threshold then
    v_penalty_applied := 'deduction';
  elsif v_offense_number >= v_warning_threshold then
    v_penalty_applied := 'warning';
  else
    v_penalty_applied := 'none';
  end if;

  insert into public.tab_switch_logs (
    attempt_id,
    offense_number,
    penalty_applied,
    client_timestamp,
    metadata_json
  ) values (
    p_attempt_id,
    v_offense_number,
    v_penalty_applied,
    v_client_timestamp,
    p_metadata_json
  );

  update public.competition_attempts
  set offense_count = v_offense_number
  where id = p_attempt_id;

  if v_penalty_applied = 'deduction' then
    -- apply deduction score based on deduction value
    -- we do not close interval nor flag auto submission
    update public.competition_attempts
    set penalty_score = penalty_score + abs(v_deduction_value)
    where id = p_attempt_id;
  elsif v_penalty_applied = 'auto_submit' then
    update public.competition_attempts
    set status = 'auto_submitted'::public.attempt_status,
        submitted_at = now()
    where id = p_attempt_id;

    update public.attempt_intervals
    set ended_at = now()
    where attempt_id = p_attempt_id and ended_at is null;
  elsif v_penalty_applied = 'disqualified' then
    update public.competition_attempts
    set status = 'disqualified'::public.attempt_status,
        submitted_at = now()
    where id = p_attempt_id;

    update public.attempt_intervals
    set ended_at = now()
    where attempt_id = p_attempt_id and ended_at is null;
  end if;

  return v_penalty_applied;
end;
$$;

grant execute on function public.log_tab_switch_offense(uuid, jsonb) to authenticated;

commit;
