begin;

alter table public.competitions
  add column if not exists leaderboard_published boolean not null default false;

update public.competitions
set leaderboard_published = coalesce(leaderboard_published, false)
where leaderboard_published is null;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type public.dispute_status as enum ('open', 'reviewing', 'accepted', 'rejected', 'resolved');
  end if;
end $$;

do $$ begin
  create type public.export_job_format as enum ('csv', 'xlsx');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.export_job_status as enum ('queued', 'processing', 'completed', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.problem_disputes (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  competition_problem_id uuid not null references public.competition_problems (id) on delete cascade,
  attempt_id uuid not null references public.competition_attempts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.problem_disputes
  add column if not exists competition_id uuid references public.competitions (id) on delete cascade;

alter table public.problem_disputes
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.problem_disputes pd
set competition_id = cp.competition_id
from public.competition_problems cp
where pd.competition_id is null
  and cp.id = pd.competition_problem_id;

alter table public.problem_disputes
  alter column competition_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_disputes_reason_not_blank_chk'
      and conrelid = 'public.problem_disputes'::regclass
  ) then
    alter table public.problem_disputes
      add constraint problem_disputes_reason_not_blank_chk
      check (nullif(btrim(reason), '') is not null) not valid;
  end if;
end;
$$;

create index if not exists problem_disputes_problem_status_idx
  on public.problem_disputes (competition_problem_id, status, created_at desc);

create index if not exists problem_disputes_competition_status_idx
  on public.problem_disputes (competition_id, status, created_at desc);

create index if not exists problem_disputes_attempt_idx
  on public.problem_disputes (attempt_id);

create index if not exists problem_disputes_reporter_idx
  on public.problem_disputes (reporter_id, created_at desc);

create table if not exists public.competition_problem_corrections (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  competition_problem_id uuid not null references public.competition_problems (id) on delete cascade,
  dispute_id uuid references public.problem_disputes (id) on delete set null,
  correction_summary text not null,
  correction_payload_json jsonb not null default '{}'::jsonb,
  request_idempotency_token text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_problem_corrections_summary_not_blank_chk'
      and conrelid = 'public.competition_problem_corrections'::regclass
  ) then
    alter table public.competition_problem_corrections
      add constraint competition_problem_corrections_summary_not_blank_chk
      check (nullif(btrim(correction_summary), '') is not null) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_problem_corrections_payload_object_chk'
      and conrelid = 'public.competition_problem_corrections'::regclass
  ) then
    alter table public.competition_problem_corrections
      add constraint competition_problem_corrections_payload_object_chk
      check (jsonb_typeof(correction_payload_json) = 'object') not valid;
  end if;
end;
$$;

create unique index if not exists competition_problem_corrections_idempotency_uq
  on public.competition_problem_corrections (competition_id, request_idempotency_token);

create index if not exists competition_problem_corrections_problem_idx
  on public.competition_problem_corrections (competition_problem_id, created_at desc);

create table if not exists public.leaderboard_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  registration_id uuid not null references public.competition_registrations (id) on delete cascade,
  attempt_id uuid not null references public.competition_attempts (id) on delete cascade,
  rank integer not null,
  display_name text not null,
  score numeric not null default 0,
  total_time_seconds integer not null default 0,
  offense_count integer not null default 0,
  published_visibility boolean not null default false,
  computed_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists leaderboard_entries_competition_registration_uq
  on public.leaderboard_entries (competition_id, registration_id);

do $$ begin
  alter table public.leaderboard_entries
    add constraint leaderboard_entries_competition_registration_uq
    unique using index leaderboard_entries_competition_registration_uq;
exception
  when duplicate_object then null;
end $$;

create index if not exists leaderboard_entries_competition_rank_idx
  on public.leaderboard_entries (competition_id, rank);

create table if not exists public.export_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  requested_by uuid not null references public.profiles (id) on delete cascade,
  format public.export_job_format not null,
  scope text not null default 'leaderboard',
  status public.export_job_status not null default 'queued',
  storage_path text,
  error_message text,
  request_idempotency_token text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'export_jobs_scope_not_blank_chk'
      and conrelid = 'public.export_jobs'::regclass
  ) then
    alter table public.export_jobs
      add constraint export_jobs_scope_not_blank_chk
      check (nullif(btrim(scope), '') is not null) not valid;
  end if;
end;
$$;

create unique index if not exists export_jobs_idempotency_uq
  on public.export_jobs (competition_id, requested_by, request_idempotency_token);

create index if not exists export_jobs_competition_created_idx
  on public.export_jobs (competition_id, created_at desc);

create index if not exists export_jobs_requested_by_created_idx
  on public.export_jobs (requested_by, created_at desc);

create or replace function public.problem_disputes_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_14_problem_disputes_set_updated_at on public.problem_disputes;
create trigger trg_14_problem_disputes_set_updated_at
before update on public.problem_disputes
for each row
execute function public.problem_disputes_set_updated_at();

create or replace function public.export_jobs_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  if new.status in ('completed'::public.export_job_status, 'failed'::public.export_job_status)
     and new.completed_at is null then
    new.completed_at := timezone('utc', now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_14_export_jobs_set_updated_at on public.export_jobs;
create trigger trg_14_export_jobs_set_updated_at
before update on public.export_jobs
for each row
execute function public.export_jobs_set_updated_at();

alter table public.problem_disputes enable row level security;
alter table public.competition_problem_corrections enable row level security;
alter table public.leaderboard_entries enable row level security;
alter table public.export_jobs enable row level security;

drop policy if exists "problem_disputes_select_scoped" on public.problem_disputes;
create policy "problem_disputes_select_scoped"
on public.problem_disputes
for select
using (
  public.jwt_is_admin()
  or reporter_id = auth.uid()
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = problem_disputes.attempt_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
  or exists (
    select 1
    from public.competitions c
    where c.id = problem_disputes.competition_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "problem_disputes_insert_participant" on public.problem_disputes;
create policy "problem_disputes_insert_participant"
on public.problem_disputes
for insert
with check (
  reporter_id = auth.uid()
  and exists (
    select 1
    from public.competition_problems cp
    where cp.id = problem_disputes.competition_problem_id
      and cp.competition_id = problem_disputes.competition_id
  )
  and exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.id = problem_disputes.attempt_id
      and ca.competition_id = problem_disputes.competition_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
);

drop policy if exists "problem_disputes_service_write" on public.problem_disputes;
create policy "problem_disputes_service_write"
on public.problem_disputes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "competition_problem_corrections_select_scoped" on public.competition_problem_corrections;
create policy "competition_problem_corrections_select_scoped"
on public.competition_problem_corrections
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competitions c
    where c.id = competition_problem_corrections.competition_id
      and c.organizer_id = auth.uid()
  )
  or exists (
    select 1
    from public.competition_registrations cr
    where cr.competition_id = competition_problem_corrections.competition_id
      and (
        cr.profile_id = auth.uid()
        or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
      )
  )
);

drop policy if exists "competition_problem_corrections_service_write" on public.competition_problem_corrections;
create policy "competition_problem_corrections_service_write"
on public.competition_problem_corrections
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "leaderboard_entries_select_scoped" on public.leaderboard_entries;
create policy "leaderboard_entries_select_scoped"
on public.leaderboard_entries
for select
using (
  public.jwt_is_admin()
  or exists (
    select 1
    from public.competitions c
    where c.id = leaderboard_entries.competition_id
      and c.organizer_id = auth.uid()
  )
  or (
    exists (
      select 1
      from public.competitions c
      where c.id = leaderboard_entries.competition_id
        and (
          (c.type = 'open'::public.competition_type and c.status <> 'draft'::public.competition_status)
          or c.leaderboard_published = true
        )
    )
    and (
      exists (
        select 1
        from public.competition_registrations cr
        where cr.competition_id = leaderboard_entries.competition_id
          and (
            cr.profile_id = auth.uid()
            or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
          )
      )
      or exists (
        select 1
        from public.competition_attempts ca
        join public.competition_registrations cr on cr.id = ca.registration_id
        where ca.competition_id = leaderboard_entries.competition_id
          and (
            cr.profile_id = auth.uid()
            or (cr.team_id is not null and public.is_active_team_member(cr.team_id, auth.uid()))
          )
      )
    )
  )
);

drop policy if exists "leaderboard_entries_service_write" on public.leaderboard_entries;
create policy "leaderboard_entries_service_write"
on public.leaderboard_entries
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "export_jobs_select_scoped" on public.export_jobs;
create policy "export_jobs_select_scoped"
on public.export_jobs
for select
using (
  requested_by = auth.uid()
  or public.jwt_is_admin()
  or exists (
    select 1
    from public.competitions c
    where c.id = export_jobs.competition_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "export_jobs_service_write" on public.export_jobs;
create policy "export_jobs_service_write"
on public.export_jobs
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

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
declare
  v_competition public.competitions%rowtype;
  v_now timestamptz := timezone('utc', now());
  v_refreshed_rows bigint := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend leaderboard flows may execute refresh_leaderboard_entries.';
  end if;

  if p_competition_id is null then
    raise exception 'competition_id is required.';
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found then
    return query
    select p_competition_id, 'not_found'::text, 0::bigint, v_now;
    return;
  end if;

  with ranked_attempts as (
    select
      ca.competition_id,
      ca.registration_id,
      ca.id as attempt_id,
      row_number() over (
        partition by ca.competition_id
        order by
          coalesce(ca.final_score, 0) desc,
          coalesce(ca.total_time_seconds, 2147483647) asc,
          coalesce(ca.submitted_at, ca.started_at, timezone('utc', now())) asc,
          ca.id asc
      ) as leaderboard_rank,
      coalesce(ca.final_score, 0) as score,
      coalesce(ca.total_time_seconds, 0) as total_time_seconds,
      coalesce(ca.offense_count, 0) as offense_count
    from public.competition_attempts ca
    where ca.competition_id = p_competition_id
      and ca.status in (
        'submitted'::public.attempt_status,
        'auto_submitted'::public.attempt_status,
        'disqualified'::public.attempt_status,
        'graded'::public.attempt_status
      )
      and coalesce(ca.is_latest_visible_result, true) = true
  ), source_rows as (
    select
      ra.competition_id,
      ra.registration_id,
      ra.attempt_id,
      ra.leaderboard_rank as rank,
      coalesce(
        nullif(btrim(cr.entry_snapshot_json ->> 'display_name'), ''),
        nullif(btrim(cr.entry_snapshot_json ->> 'team_name'), ''),
        nullif(btrim(cr.entry_snapshot_json ->> 'full_name'), ''),
        nullif(btrim(t.name), ''),
        nullif(btrim(p.full_name), ''),
        'Participant'
      ) as display_name,
      ra.score,
      ra.total_time_seconds,
      ra.offense_count,
      case
        when v_competition.type = 'open'::public.competition_type
             and v_competition.status <> 'draft'::public.competition_status
          then true
        else coalesce(v_competition.leaderboard_published, false)
      end as published_visibility,
      v_now as computed_at
    from ranked_attempts ra
    join public.competition_registrations cr on cr.id = ra.registration_id
    left join public.teams t on t.id = cr.team_id
    left join public.profiles p on p.id = cr.profile_id
  ), upserted as (
    insert into public.leaderboard_entries (
      competition_id,
      registration_id,
      attempt_id,
      rank,
      display_name,
      score,
      total_time_seconds,
      offense_count,
      published_visibility,
      computed_at
    )
    select
      sr.competition_id,
      sr.registration_id,
      sr.attempt_id,
      sr.rank,
      sr.display_name,
      sr.score,
      sr.total_time_seconds,
      sr.offense_count,
      sr.published_visibility,
      sr.computed_at
    from source_rows sr
    on conflict on constraint leaderboard_entries_competition_registration_uq
    do update set
      attempt_id = excluded.attempt_id,
      rank = excluded.rank,
      display_name = excluded.display_name,
      score = excluded.score,
      total_time_seconds = excluded.total_time_seconds,
      offense_count = excluded.offense_count,
      published_visibility = excluded.published_visibility,
      computed_at = excluded.computed_at
    returning 1
  )
  select count(*) into v_refreshed_rows from upserted;

  delete from public.leaderboard_entries le
  where le.competition_id = p_competition_id
    and not exists (
      select 1
      from public.competition_attempts ca
      where ca.id = le.attempt_id
        and ca.competition_id = p_competition_id
        and ca.status in (
          'submitted'::public.attempt_status,
          'auto_submitted'::public.attempt_status,
          'disqualified'::public.attempt_status,
          'graded'::public.attempt_status
        )
    );

  return query
  select p_competition_id, 'ok'::text, v_refreshed_rows, v_now;
end;
$$;

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
  v_graded_attempts bigint := 0;
  v_refreshed_rows bigint := 0;
  v_now timestamptz := timezone('utc', now());
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

  update public.competition_attempts ca
  set final_score = coalesce(ca.raw_score, 0) - coalesce(ca.penalty_score, 0),
      graded_at = coalesce(ca.graded_at, v_now),
      status = case
        when ca.status in ('submitted'::public.attempt_status, 'auto_submitted'::public.attempt_status)
          then 'graded'::public.attempt_status
        else ca.status
      end
  where ca.competition_id = p_competition_id
    and ca.status in (
      'submitted'::public.attempt_status,
      'auto_submitted'::public.attempt_status,
      'disqualified'::public.attempt_status,
      'graded'::public.attempt_status
    );

  get diagnostics v_graded_attempts = row_count;

  select rle.refreshed_rows
  into v_refreshed_rows
  from public.refresh_leaderboard_entries(p_competition_id) rle;

  return query
  select
    p_competition_id,
    v_token,
    'ok'::text,
    v_graded_attempts,
    coalesce(v_refreshed_rows, 0),
    v_now;
end;
$$;

create or replace function public.record_competition_problem_correction(
  p_competition_id uuid,
  p_competition_problem_id uuid,
  p_dispute_id uuid,
  p_correction_summary text,
  p_correction_payload_json jsonb,
  p_request_idempotency_token text
)
returns table (
  machine_code text,
  correction_id uuid,
  competition_id uuid,
  dispute_id uuid,
  replayed boolean,
  changed boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition_problem public.competition_problems%rowtype;
  v_existing public.competition_problem_corrections%rowtype;
  v_new public.competition_problem_corrections%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_summary text := btrim(coalesce(p_correction_summary, ''));
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend correction flows may execute record_competition_problem_correction.';
  end if;

  if p_competition_id is null or p_competition_problem_id is null then
    return query
    select 'competition_problem_required', null::uuid, p_competition_id, p_dispute_id, false, false, null::timestamptz;
    return;
  end if;

  if v_token = '' then
    return query
    select 'request_idempotency_token_required', null::uuid, p_competition_id, p_dispute_id, false, false, null::timestamptz;
    return;
  end if;

  if v_summary = '' then
    return query
    select 'correction_summary_required', null::uuid, p_competition_id, p_dispute_id, false, false, null::timestamptz;
    return;
  end if;

  select *
  into v_competition_problem
  from public.competition_problems cp
  where cp.id = p_competition_problem_id
    and cp.competition_id = p_competition_id;

  if not found then
    return query
    select 'competition_problem_not_found', null::uuid, p_competition_id, p_dispute_id, false, false, null::timestamptz;
    return;
  end if;

  select *
  into v_existing
  from public.competition_problem_corrections cpc
  where cpc.competition_id = p_competition_id
    and cpc.request_idempotency_token = v_token;

  if found then
    return query
    select 'ok', v_existing.id, v_existing.competition_id, v_existing.dispute_id, true, false, v_existing.created_at;
    return;
  end if;

  insert into public.competition_problem_corrections (
    competition_id,
    competition_problem_id,
    dispute_id,
    correction_summary,
    correction_payload_json,
    request_idempotency_token,
    created_by
  )
  values (
    p_competition_id,
    p_competition_problem_id,
    p_dispute_id,
    v_summary,
    coalesce(p_correction_payload_json, '{}'::jsonb),
    v_token,
    auth.uid()
  )
  returning *
  into v_new;

  return query
  select 'ok', v_new.id, v_new.competition_id, v_new.dispute_id, false, true, v_new.created_at;
end;
$$;

create or replace function public.publish_leaderboard(
  p_competition_id uuid,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null
)
returns table (
  machine_code text,
  competition_id uuid,
  leaderboard_published boolean,
  event_id uuid,
  replayed boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := coalesce(
    case when auth.role() = 'service_role' then p_actor_user_id else auth.uid() end,
    auth.uid()
  );
  v_competition public.competitions%rowtype;
  v_actor_is_admin boolean := false;
  v_event public.competition_events%rowtype;
  v_payload_json jsonb;
  v_payload_hash text;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
begin
  if v_actor_id is null then
    return query
    select 'forbidden', p_competition_id, false, null::uuid, false, false;
    return;
  end if;

  if p_competition_id is null then
    return query
    select 'competition_id_required', null::uuid, false, null::uuid, false, false;
    return;
  end if;

  if v_token = '' then
    return query
    select 'request_idempotency_token_required', p_competition_id, false, null::uuid, false, false;
    return;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role = 'admin'
      and coalesce(p.is_active, true) = true
  ) into v_actor_is_admin;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id
  for update;

  if not found then
    return query
    select 'not_found', p_competition_id, false, null::uuid, false, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query
    select 'deleted', p_competition_id, false, null::uuid, false, false;
    return;
  end if;

  if not v_actor_is_admin and v_competition.organizer_id <> v_actor_id then
    return query
    select 'forbidden', p_competition_id, false, null::uuid, false, false;
    return;
  end if;

  if v_competition.status = 'draft'::public.competition_status then
    return query
    select 'invalid_transition', p_competition_id, coalesce(v_competition.leaderboard_published, false), null::uuid, false, false;
    return;
  end if;

  select *
  into v_event
  from public.competition_events ce
  where ce.competition_id = p_competition_id
    and ce.control_action = 'publish_leaderboard'
    and ce.request_idempotency_token = v_token
    and ce.actor_user_id = v_actor_id
  limit 1;

  if found then
    return query
    select
      'ok',
      p_competition_id,
      coalesce(v_competition.leaderboard_published, false),
      v_event.id,
      true,
      false;
    return;
  end if;

  update public.competitions c
  set leaderboard_published = true,
      updated_at = timezone('utc', now())
  where c.id = p_competition_id
    and c.leaderboard_published is distinct from true
  returning *
  into v_competition;

  if not found then
    select *
    into v_competition
    from public.competitions c
    where c.id = p_competition_id;
  end if;

  v_payload_json := jsonb_build_object(
    'competition_id', p_competition_id,
    'leaderboard_published', true
  );
  v_payload_hash := encode(extensions.digest(v_payload_json::text, 'sha256'), 'hex');

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
    v_actor_id,
    'leaderboard_published',
    'publish_leaderboard',
    v_token,
    v_payload_hash,
    v_payload_json,
    jsonb_build_object('source', 'organizer_api')
  )
  returning *
  into v_event;

  return query
  select
    'ok',
    p_competition_id,
    coalesce(v_competition.leaderboard_published, true),
    v_event.id,
    false,
    true;
end;
$$;

create or replace function public.queue_export_job(
  p_competition_id uuid,
  p_format public.export_job_format,
  p_scope text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null
)
returns table (
  machine_code text,
  export_job_id uuid,
  competition_id uuid,
  requested_by uuid,
  format public.export_job_format,
  scope text,
  status public.export_job_status,
  replayed boolean,
  changed boolean,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := coalesce(
    case when auth.role() = 'service_role' then p_actor_user_id else auth.uid() end,
    auth.uid()
  );
  v_actor_is_admin boolean := false;
  v_competition public.competitions%rowtype;
  v_existing public.export_jobs%rowtype;
  v_job public.export_jobs%rowtype;
  v_scope text := btrim(coalesce(p_scope, 'leaderboard'));
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
begin
  if v_actor_id is null then
    return query
    select 'forbidden', null::uuid, p_competition_id, null::uuid, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  if p_competition_id is null then
    return query
    select 'competition_id_required', null::uuid, null::uuid, v_actor_id, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  if v_token = '' then
    return query
    select 'request_idempotency_token_required', null::uuid, p_competition_id, v_actor_id, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role = 'admin'
      and coalesce(p.is_active, true) = true
  ) into v_actor_is_admin;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found then
    return query
    select 'not_found', null::uuid, p_competition_id, v_actor_id, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  if v_competition.is_deleted then
    return query
    select 'deleted', null::uuid, p_competition_id, v_actor_id, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  if v_competition.status = 'draft'::public.competition_status then
    return query
    select 'invalid_transition', null::uuid, p_competition_id, v_actor_id, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  if not v_actor_is_admin and v_competition.organizer_id <> v_actor_id then
    return query
    select 'forbidden', null::uuid, p_competition_id, v_actor_id, p_format, v_scope, null::public.export_job_status, false, false, null::timestamptz;
    return;
  end if;

  select *
  into v_existing
  from public.export_jobs ej
  where ej.competition_id = p_competition_id
    and ej.requested_by = v_actor_id
    and ej.request_idempotency_token = v_token
  limit 1;

  if found then
    return query
    select
      'ok',
      v_existing.id,
      v_existing.competition_id,
      v_existing.requested_by,
      v_existing.format,
      v_existing.scope,
      v_existing.status,
      true,
      false,
      v_existing.created_at;
    return;
  end if;

  insert into public.export_jobs (
    competition_id,
    requested_by,
    format,
    scope,
    status,
    request_idempotency_token
  )
  values (
    p_competition_id,
    v_actor_id,
    p_format,
    v_scope,
    'queued'::public.export_job_status,
    v_token
  )
  returning *
  into v_job;

  return query
  select
    'ok',
    v_job.id,
    v_job.competition_id,
    v_job.requested_by,
    v_job.format,
    v_job.scope,
    v_job.status,
    false,
    true,
    v_job.created_at;
end;
$$;

create or replace function public.resolve_problem_dispute(
  p_dispute_id uuid,
  p_status public.dispute_status,
  p_resolution_note text,
  p_request_idempotency_token text,
  p_actor_user_id uuid default null
)
returns table (
  machine_code text,
  dispute_id uuid,
  competition_id uuid,
  status public.dispute_status,
  correction_id uuid,
  replayed boolean,
  changed boolean,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := coalesce(
    case when auth.role() = 'service_role' then p_actor_user_id else auth.uid() end,
    auth.uid()
  );
  v_actor_is_admin boolean := false;
  v_dispute public.problem_disputes%rowtype;
  v_competition public.competitions%rowtype;
  v_event public.competition_events%rowtype;
  v_token text := btrim(coalesce(p_request_idempotency_token, ''));
  v_note text := btrim(coalesce(p_resolution_note, ''));
  v_now timestamptz := timezone('utc', now());
  v_refresh_rows bigint := 0;
  v_correction_id uuid := null;
  v_recalc_machine_code text := null;
begin
  if v_actor_id is null then
    return query
    select 'forbidden', p_dispute_id, null::uuid, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  if p_dispute_id is null then
    return query
    select 'dispute_id_required', null::uuid, null::uuid, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  if v_token = '' then
    return query
    select 'request_idempotency_token_required', p_dispute_id, null::uuid, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  if p_status not in (
    'reviewing'::public.dispute_status,
    'accepted'::public.dispute_status,
    'rejected'::public.dispute_status,
    'resolved'::public.dispute_status
  ) then
    return query
    select 'invalid_status', p_dispute_id, null::uuid, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_actor_id
      and p.role = 'admin'
      and coalesce(p.is_active, true) = true
  ) into v_actor_is_admin;

  select pd.*
  into v_dispute
  from public.problem_disputes pd
  where pd.id = p_dispute_id
  for update;

  if not found then
    return query
    select 'not_found', p_dispute_id, null::uuid, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  select c.*
  into v_competition
  from public.competition_problems cp
  join public.competitions c on c.id = cp.competition_id
  where cp.id = v_dispute.competition_problem_id;

  if not found then
    return query
    select 'not_found', p_dispute_id, null::uuid, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  if not v_actor_is_admin and v_competition.organizer_id <> v_actor_id then
    return query
    select 'forbidden', p_dispute_id, v_competition.id, p_status, null::uuid, false, false, null::timestamptz;
    return;
  end if;

  select *
  into v_event
  from public.competition_events ce
  where ce.competition_id = v_competition.id
    and ce.control_action = 'resolve_problem_dispute'
    and ce.request_idempotency_token = v_token
    and ce.actor_user_id = v_actor_id
  limit 1;

  if found then
    return query
    select
      'ok',
      v_dispute.id,
      v_competition.id,
      v_dispute.status,
      null::uuid,
      true,
      false,
      v_dispute.resolved_at;
    return;
  end if;

  if v_dispute.status in (
    'accepted'::public.dispute_status,
    'rejected'::public.dispute_status,
    'resolved'::public.dispute_status
  ) then
    return query
    select
      'invalid_transition',
      v_dispute.id,
      v_competition.id,
      v_dispute.status,
      null::uuid,
      false,
      false,
      v_dispute.resolved_at;
    return;
  end if;

  if p_status in ('accepted'::public.dispute_status, 'rejected'::public.dispute_status, 'resolved'::public.dispute_status)
     and v_note = '' then
    return query
    select
      'resolution_note_required',
      v_dispute.id,
      v_competition.id,
      v_dispute.status,
      null::uuid,
      false,
      false,
      v_dispute.resolved_at;
    return;
  end if;

  update public.problem_disputes pd
  set status = p_status,
      resolution_note = case when p_status = 'reviewing'::public.dispute_status then null else v_note end,
      resolved_by = case
        when p_status in ('accepted'::public.dispute_status, 'rejected'::public.dispute_status, 'resolved'::public.dispute_status)
          then v_actor_id
        else null
      end,
      resolved_at = case
        when p_status in ('accepted'::public.dispute_status, 'rejected'::public.dispute_status, 'resolved'::public.dispute_status)
          then v_now
        else null
      end
  where pd.id = p_dispute_id
  returning *
  into v_dispute;

  if p_status = 'accepted'::public.dispute_status then
    select rpc_result.correction_id
    into v_correction_id
    from public.record_competition_problem_correction(
      v_competition.id,
      v_dispute.competition_problem_id,
      v_dispute.id,
      v_note,
      jsonb_build_object(
        'dispute_id', v_dispute.id,
        'attempt_id', v_dispute.attempt_id,
        'status', p_status
      ),
      concat('dispute-correction:', v_dispute.id::text, ':', v_token)
    ) rpc_result;

    select recalc_result.machine_code
    into v_recalc_machine_code
    from public.recalculate_competition_scores(
      v_competition.id,
      concat('dispute-recalc:', v_dispute.id::text, ':', v_token)
    ) recalc_result;

    select rle.refreshed_rows
    into v_refresh_rows
    from public.refresh_leaderboard_entries(v_competition.id) rle;
  end if;

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
    v_competition.id,
    v_actor_id,
    'problem_dispute_resolved',
    'resolve_problem_dispute',
    v_token,
    encode(
      extensions.digest(
        jsonb_build_object(
          'dispute_id', v_dispute.id,
          'status', v_dispute.status,
          'resolved_at', v_dispute.resolved_at
        )::text,
        'sha256'
      ),
      'hex'
    ),
    jsonb_build_object(
      'dispute_id', v_dispute.id,
      'status', v_dispute.status,
      'correction_id', v_correction_id
    ),
    jsonb_build_object(
      'refresh_rows', coalesce(v_refresh_rows, 0),
      'recalc_machine_code', v_recalc_machine_code
    )
  )
  returning *
  into v_event;

  return query
  select
    'ok',
    v_dispute.id,
    v_competition.id,
    v_dispute.status,
    v_correction_id,
    false,
    true,
    v_dispute.resolved_at;
end;
$$;

revoke all on function public.refresh_leaderboard_entries(uuid) from public;
revoke all on function public.recalculate_competition_scores(uuid, text) from public;
revoke all on function public.record_competition_problem_correction(uuid, uuid, uuid, text, jsonb, text) from public;
revoke all on function public.publish_leaderboard(uuid, text, uuid) from public;
revoke all on function public.queue_export_job(uuid, public.export_job_format, text, text, uuid) from public;
revoke all on function public.resolve_problem_dispute(uuid, public.dispute_status, text, text, uuid) from public;

grant execute on function public.refresh_leaderboard_entries(uuid) to service_role;
grant execute on function public.recalculate_competition_scores(uuid, text) to service_role;
grant execute on function public.record_competition_problem_correction(uuid, uuid, uuid, text, jsonb, text) to service_role;
grant execute on function public.publish_leaderboard(uuid, text, uuid) to service_role;
grant execute on function public.queue_export_job(uuid, public.export_job_format, text, text, uuid) to service_role;
grant execute on function public.resolve_problem_dispute(uuid, public.dispute_status, text, text, uuid) to service_role;

grant select, insert, update, delete on public.problem_disputes to service_role;
grant select, insert, update, delete on public.competition_problem_corrections to service_role;
grant select, insert, update, delete on public.leaderboard_entries to service_role;
grant select, insert, update, delete on public.export_jobs to service_role;

grant select on public.problem_disputes to authenticated;
grant select on public.competition_problem_corrections to authenticated;
grant select on public.leaderboard_entries to authenticated;
grant select on public.export_jobs to authenticated;

commit;
