begin;

create or replace function public.snapshot_competition_problems(p_competition_id uuid)
returns table (
  machine_code text,
  competition_id uuid,
  selected_problem_count bigint,
  snapshotted_count bigint,
  snapshot_hash text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_selected_count bigint := 0;
  v_snapshotted_count bigint := 0;
  v_complete_count bigint := 0;
  v_snapshot_hash text;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden', p_competition_id, 0::bigint, 0::bigint, null::text;
    return;
  end if;

  if p_competition_id is null then
    return query
      select 'competition_id_required', null::uuid, 0::bigint, 0::bigint, null::text;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, 0::bigint, 0::bigint, null::text;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, 0::bigint, 0::bigint, null::text;
    return;
  end if;

  if v_competition.status <> 'draft'::public.competition_status then
    return query
      select 'not_draft', p_competition_id, 0::bigint, 0::bigint, null::text;
    return;
  end if;

  update public.competition_problems cp
  set points = case
        when v_competition.scoring_mode::text = 'custom'
             and coalesce(v_competition.custom_points, '{}'::jsonb) ? cp.problem_id::text
             and (v_competition.custom_points ->> cp.problem_id::text) ~ '^[0-9]+$'
          then greatest(0, (v_competition.custom_points ->> cp.problem_id::text)::integer)
        else case coalesce(p.difficulty, cp.difficulty_snapshot)
          when 'easy'::public.difficulty then 1
          when 'average'::public.difficulty then 2
          when 'difficult'::public.difficulty then 3
          else 1
        end
      end,
      content_snapshot_latex = coalesce(cp.content_snapshot_latex, p.content_latex, p.content),
      options_snapshot_json = coalesce(cp.options_snapshot_json, p.options_json, p.options),
      answer_key_snapshot_json = coalesce(cp.answer_key_snapshot_json, p.answer_key_json, p.answers),
      explanation_snapshot_latex = coalesce(cp.explanation_snapshot_latex, p.explanation_latex),
      difficulty_snapshot = coalesce(cp.difficulty_snapshot, p.difficulty),
      tags_snapshot = coalesce(cp.tags_snapshot, p.tags),
      image_snapshot_path = coalesce(cp.image_snapshot_path, p.image_path, p.image_url)
  from public.problems p
  where cp.competition_id = p_competition_id
    and cp.problem_id = p.id;

  get diagnostics v_snapshotted_count = row_count;

  select count(*),
         count(*) filter (
           where cp.points is not null
             and cp.content_snapshot_latex is not null
             and cp.answer_key_snapshot_json is not null
         )
  into v_selected_count, v_complete_count
  from public.competition_problems cp
  where cp.competition_id = p_competition_id;

  if v_selected_count = 0 then
    return query
      select 'no_problems_selected', p_competition_id, v_selected_count, v_snapshotted_count, null::text;
    return;
  end if;

  if v_selected_count < 10 or v_selected_count > 100 then
    return query
      select 'problem_count_out_of_range', p_competition_id, v_selected_count, v_snapshotted_count, null::text;
    return;
  end if;

  if v_complete_count <> v_selected_count then
    return query
      select 'snapshot_incomplete', p_competition_id, v_selected_count, v_snapshotted_count, null::text;
    return;
  end if;

  select encode(
    extensions.digest(
      coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'order_index', cp.order_index,
              'problem_id', cp.problem_id,
              'points', cp.points,
              'content_snapshot_latex', cp.content_snapshot_latex,
              'options_snapshot_json', cp.options_snapshot_json,
              'answer_key_snapshot_json', cp.answer_key_snapshot_json,
              'explanation_snapshot_latex', cp.explanation_snapshot_latex,
              'difficulty_snapshot', cp.difficulty_snapshot,
              'tags_snapshot', cp.tags_snapshot,
              'image_snapshot_path', cp.image_snapshot_path
            )
            order by cp.order_index, cp.id
          )
          from public.competition_problems cp
          where cp.competition_id = p_competition_id
        )::text,
        '[]'
      ),
      'sha256'
    ),
    'hex'
  )
  into v_snapshot_hash;

  return query
    select 'ok', p_competition_id, v_selected_count, v_snapshotted_count, v_snapshot_hash;
end;
$$;

commit;
