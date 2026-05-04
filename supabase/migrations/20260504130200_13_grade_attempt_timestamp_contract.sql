begin;

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
    now();
end;
$$;

revoke all on function public.grade_attempt(uuid) from public;
revoke all on function public.grade_attempt(uuid) from anon, authenticated;
grant execute on function public.grade_attempt(uuid) to service_role;

commit;
