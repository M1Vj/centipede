begin;

drop function if exists public.grade_attempt(uuid);
drop function if exists public.recalculate_competition_scores(uuid, text);
drop function if exists public.refresh_leaderboard_entries(uuid);

create or replace function public.grade_attempt(p_attempt_id uuid)
returns table (
  attempt_id uuid,
  competition_id uuid,
  machine_code text,
  raw_score numeric,
  penalty_score numeric,
  final_score numeric,
  graded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted backend grading flows may execute grade_attempt.';
  end if;

  if p_attempt_id is null then
    raise exception 'attempt_id is required.';
  end if;

  return query
  select
    p_attempt_id,
    null::uuid,
    'deferred_owner_schema'::text,
    0::numeric,
    0::numeric,
    0::numeric,
    timezone('utc', now());
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
    timezone('utc', now());
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
    timezone('utc', now());
end;
$$;

revoke all on function public.grade_attempt(uuid) from public;
revoke all on function public.recalculate_competition_scores(uuid, text) from public;
revoke all on function public.refresh_leaderboard_entries(uuid) from public;

grant execute on function public.grade_attempt(uuid) to service_role;
grant execute on function public.recalculate_competition_scores(uuid, text) to service_role;
grant execute on function public.refresh_leaderboard_entries(uuid) to service_role;

commit;
