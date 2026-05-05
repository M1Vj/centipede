begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dispute_status') then
    create type public.dispute_status as enum (
      'open',
      'reviewing',
      'accepted',
      'rejected',
      'resolved'
    );
  end if;
end $$;

create table if not exists public.problem_disputes (
  id uuid primary key default gen_random_uuid(),
  competition_problem_id uuid not null references public.competition_problems (id),
  attempt_id uuid not null references public.competition_attempts (id),
  reporter_id uuid not null references public.profiles (id),
  reason text not null,
  status public.dispute_status not null default 'open',
  resolution_note text,
  resolved_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint problem_disputes_reason_length_ck check (char_length(btrim(reason)) between 10 and 1000),
  constraint problem_disputes_open_resolution_ck check (
    (status in ('open', 'reviewing') and resolved_at is null)
    or (status in ('accepted', 'rejected', 'resolved') and resolved_at is not null)
  )
);

create index if not exists problem_disputes_problem_status_idx
  on public.problem_disputes (competition_problem_id, status, created_at desc);

create index if not exists problem_disputes_attempt_reporter_idx
  on public.problem_disputes (attempt_id, reporter_id, created_at desc);

create unique index if not exists problem_disputes_one_open_per_attempt_problem_reporter_uq
  on public.problem_disputes (competition_problem_id, attempt_id, reporter_id)
  where status in ('open', 'reviewing');

alter table public.problem_disputes enable row level security;

drop policy if exists "problem_disputes_select_participant" on public.problem_disputes;
create policy "problem_disputes_select_participant"
on public.problem_disputes
for select
using (
  public.jwt_is_admin()
  or reporter_id = auth.uid()
  or exists (
    select 1
    from public.competition_problems cp
    join public.competitions c on c.id = cp.competition_id
    where cp.id = problem_disputes.competition_problem_id
      and c.organizer_id = auth.uid()
  )
);

drop policy if exists "problem_disputes_service_write" on public.problem_disputes;
create policy "problem_disputes_service_write"
on public.problem_disputes
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

create or replace function public.get_attempt_review_summary(
  p_attempt_id uuid,
  p_actor_user_id uuid
)
returns table (
  total integer,
  blank integer,
  filled integer,
  solved integer,
  reset integer,
  answered integer,
  missing_rows_inferred_blank integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.competition_attempts%rowtype;
  v_registration public.competition_registrations%rowtype;
  v_total_problems integer := 0;
  v_distinct_answer_rows integer := 0;
  v_missing_blank integer := 0;
begin
  if auth.role() <> 'service_role' then
    return query select 0, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  select *
  into v_attempt
  from public.competition_attempts ca
  where ca.id = p_attempt_id;

  if not found then
    return query select 0, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  select *
  into v_registration
  from public.competition_registrations cr
  where cr.id = v_attempt.registration_id;

  if not (
    v_registration.profile_id = p_actor_user_id
    or exists (
      select 1
      from public.team_memberships tm
      where tm.team_id = v_registration.team_id
        and tm.profile_id = p_actor_user_id
        and tm.is_active = true
    )
  ) then
    return query select 0, 0, 0, 0, 0, 0, 0;
    return;
  end if;

  select count(*)::integer
  into v_total_problems
  from public.competition_problems cp
  where cp.competition_id = v_attempt.competition_id;

  select count(distinct aa.competition_problem_id)::integer
  into v_distinct_answer_rows
  from public.attempt_answers aa
  join public.competition_problems cp on cp.id = aa.competition_problem_id
  where aa.attempt_id = p_attempt_id
    and cp.competition_id = v_attempt.competition_id;

  v_missing_blank := greatest(v_total_problems - v_distinct_answer_rows, 0);

  return query
    select
      v_total_problems,
      (
        count(distinct aa.competition_problem_id) filter (where aa.status_flag = 'blank'::public.answer_status_flag)
      )::integer + v_missing_blank,
      (
        count(distinct aa.competition_problem_id) filter (where aa.status_flag = 'filled'::public.answer_status_flag)
      )::integer,
      (
        count(distinct aa.competition_problem_id) filter (where aa.status_flag = 'solved'::public.answer_status_flag)
      )::integer,
      (
        count(distinct aa.competition_problem_id) filter (where aa.status_flag = 'reset'::public.answer_status_flag)
      )::integer,
      (
        count(distinct aa.competition_problem_id) filter (
          where aa.status_flag in (
            'filled'::public.answer_status_flag,
            'solved'::public.answer_status_flag
          )
        )
      )::integer,
      v_missing_blank
    from public.attempt_answers aa
    join public.competition_problems cp on cp.id = aa.competition_problem_id
    where aa.attempt_id = p_attempt_id
      and cp.competition_id = v_attempt.competition_id;
end;
$$;

create or replace function public.can_view_answer_key(
  p_competition_id uuid,
  p_viewer_profile_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
begin
  if auth.role() <> 'service_role' then
    return false;
  end if;

  if p_competition_id is null or p_viewer_profile_id is null then
    return false;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found or v_competition.answer_key_visibility = 'hidden'::public.answer_key_visibility then
    return false;
  end if;

  if v_competition.status not in ('ended'::public.competition_status, 'archived'::public.competition_status) then
    return false;
  end if;

  if v_competition.end_time is not null and now() < v_competition.end_time then
    return false;
  end if;

  return exists (
    select 1
    from public.competition_registrations cr
    where cr.competition_id = p_competition_id
      and cr.status = 'registered'::public.registration_status
      and (
        cr.profile_id = p_viewer_profile_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_viewer_profile_id)
        )
      )
  )
  or exists (
    select 1
    from public.competition_attempts ca
    join public.competition_registrations cr on cr.id = ca.registration_id
    where ca.competition_id = p_competition_id
      and (
        cr.profile_id = p_viewer_profile_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_viewer_profile_id)
        )
      )
  );
end;
$$;

create or replace function public.get_answer_key_snapshots(
  p_competition_id uuid,
  p_viewer_profile_id uuid
)
returns table (
  competition_problem_id uuid,
  order_index integer,
  answer_key_snapshot_json jsonb,
  explanation_snapshot_latex text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_view_answer_key(p_competition_id, p_viewer_profile_id) then
    return;
  end if;

  return query
    select
      cp.id,
      cp.order_index,
      cp.answer_key_snapshot_json,
      cp.explanation_snapshot_latex
    from public.competition_problems cp
    where cp.competition_id = p_competition_id
    order by cp.order_index asc nulls last, cp.id asc;
end;
$$;

create or replace function public.create_problem_dispute(
  p_competition_id uuid,
  p_competition_problem_id uuid,
  p_attempt_id uuid,
  p_reporter_id uuid,
  p_reason text
)
returns table (
  machine_code text,
  dispute_id uuid,
  status public.dispute_status,
  replayed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_reason text := btrim(regexp_replace(coalesce(p_reason, ''), '\s+', ' ', 'g'));
  v_existing public.problem_disputes%rowtype;
  v_inserted public.problem_disputes%rowtype;
  dispute_spam_window interval := interval '1 minute';
begin
  if auth.role() <> 'service_role' then
    return query select 'forbidden'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if p_competition_id is null or p_competition_problem_id is null or p_attempt_id is null or p_reporter_id is null then
    return query select 'target_required'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if char_length(v_reason) < 10 or char_length(v_reason) > 1000 then
    return query select 'invalid_reason'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  select *
  into v_competition
  from public.competitions c
  where c.id = p_competition_id;

  if not found then
    return query select 'competition_not_found'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if v_competition.status not in ('ended'::public.competition_status, 'archived'::public.competition_status) then
    return query select 'competition_not_ended'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  if not exists (
    select 1
    from public.competition_problems cp
    join public.competition_attempts ca on ca.competition_id = cp.competition_id
    join public.competition_registrations cr on cr.id = ca.registration_id
    where cp.id = p_competition_problem_id
      and cp.competition_id = p_competition_id
      and ca.id = p_attempt_id
      and (
        cr.profile_id = p_reporter_id
        or (
          cr.team_id is not null
          and public.is_active_team_member(cr.team_id, p_reporter_id)
        )
      )
  ) then
    return query select 'forbidden'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  select *
  into v_existing
  from public.problem_disputes pd
  where pd.competition_problem_id = p_competition_problem_id
    and pd.attempt_id = p_attempt_id
    and pd.reporter_id = p_reporter_id
    and pd.status in ('open'::public.dispute_status, 'reviewing'::public.dispute_status)
  order by pd.created_at desc
  limit 1;

  if found then
    return query select 'already_open'::text, v_existing.id, v_existing.status, true;
    return;
  end if;

  if exists (
    select 1
    from public.problem_disputes pd
    where pd.reporter_id = p_reporter_id
      and pd.attempt_id = p_attempt_id
      and pd.created_at > now() - dispute_spam_window
  ) then
    return query select 'dispute_rate_limited'::text, null::uuid, null::public.dispute_status, false;
    return;
  end if;

  insert into public.problem_disputes (
    competition_problem_id,
    attempt_id,
    reporter_id,
    reason,
    status
  )
  values (
    p_competition_problem_id,
    p_attempt_id,
    p_reporter_id,
    v_reason,
    'open'::public.dispute_status
  )
  returning * into v_inserted;

  return query select 'ok'::text, v_inserted.id, v_inserted.status, false;
end;
$$;

revoke all on table public.problem_disputes from anon, authenticated;
grant select on table public.problem_disputes to authenticated;
grant all privileges on public.problem_disputes to service_role;

revoke all on function public.get_attempt_review_summary(uuid, uuid) from public;
revoke all on function public.can_view_answer_key(uuid, uuid) from public;
revoke all on function public.get_answer_key_snapshots(uuid, uuid) from public;
revoke all on function public.create_problem_dispute(uuid, uuid, uuid, uuid, text) from public;
grant execute on function public.get_attempt_review_summary(uuid, uuid) to service_role;
grant execute on function public.can_view_answer_key(uuid, uuid) to service_role;
grant execute on function public.get_answer_key_snapshots(uuid, uuid) to service_role;
grant execute on function public.create_problem_dispute(uuid, uuid, uuid, uuid, text) to service_role;

commit;
