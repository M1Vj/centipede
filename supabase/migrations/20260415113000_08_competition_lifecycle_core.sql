begin;

-- Canonical lifecycle enums introduced in branch-08.
do $$ begin
  create type public.competition_status as enum (
    'draft',
    'published',
    'live',
    'paused',
    'ended',
    'archived'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.answer_key_visibility as enum (
    'after_end',
    'hidden'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.attempt_grading_mode as enum (
    'highest_score',
    'latest_score',
    'average_score'
  );
exception
  when duplicate_object then null;
end $$;

-- Extend competitions with canonical lifecycle and snapshot controls.
alter table public.competitions
  add column if not exists status public.competition_status,
  add column if not exists answer_key_visibility public.answer_key_visibility default 'after_end',
  add column if not exists scoring_snapshot_json jsonb,
  add column if not exists draft_revision integer default 1,
  add column if not exists draft_version integer default 1,
  add column if not exists multi_attempt_grading_mode public.attempt_grading_mode default 'highest_score',
  add column if not exists is_deleted boolean default false,
  add column if not exists published_at timestamptz,
  add column if not exists updated_at timestamptz default timezone('utc', now()),
  add column if not exists end_time timestamptz;

alter table public.competitions
  alter column status set default 'draft',
  alter column answer_key_visibility set default 'after_end',
  alter column draft_revision set default 1,
  alter column draft_version set default 1,
  alter column multi_attempt_grading_mode set default 'highest_score',
  alter column is_deleted set default false,
  alter column updated_at set default timezone('utc', now());

update public.competitions
set status = case
      when coalesce(is_deleted, false) then 'archived'::public.competition_status
      when coalesce(is_paused, false) then 'paused'::public.competition_status
      when coalesce(published, false) then 'published'::public.competition_status
      else 'draft'::public.competition_status
    end,
    answer_key_visibility = coalesce(answer_key_visibility, 'after_end'::public.answer_key_visibility),
    draft_revision = case
      when coalesce(draft_revision, 0) < 1 then 1
      else coalesce(draft_revision, 1)
    end,
    draft_version = case
      when coalesce(draft_version, 0) < 1 then 1
      else coalesce(draft_version, 1)
    end,
    multi_attempt_grading_mode = coalesce(multi_attempt_grading_mode, 'highest_score'::public.attempt_grading_mode),
    is_deleted = coalesce(is_deleted, false),
    updated_at = coalesce(updated_at, timezone('utc', now())),
    published_at = case
      when coalesce(published, false) then coalesce(published_at, created_at)
      else published_at
    end
where status is null
   or answer_key_visibility is null
   or draft_revision is null
   or draft_revision < 1
   or draft_version is null
   or draft_version < 1
  or multi_attempt_grading_mode is null
   or is_deleted is null
   or updated_at is null
   or (coalesce(published, false) and published_at is null);

alter table public.competitions
  alter column status set not null,
  alter column answer_key_visibility set not null,
  alter column draft_revision set not null,
  alter column draft_version set not null,
  alter column multi_attempt_grading_mode set not null,
  alter column is_deleted set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_scoring_snapshot_json_object_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_scoring_snapshot_json_object_chk
      check (
        scoring_snapshot_json is null
        or jsonb_typeof(scoring_snapshot_json) = 'object'
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_multi_attempt_mode_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_multi_attempt_mode_chk
      check (
        type <> 'scheduled'::public.competition_type
        or multi_attempt_grading_mode = 'highest_score'::public.attempt_grading_mode
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_attempts_by_type_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_attempts_by_type_chk
      check (
        (type = 'scheduled'::public.competition_type and attempts_allowed = 1)
        or (type = 'open'::public.competition_type and attempts_allowed between 1 and 3)
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_open_individual_only_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_open_individual_only_chk
      check (
        type <> 'open'::public.competition_type
        or format = 'individual'::public.competition_format
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_individual_capacity_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_individual_capacity_chk
      check (
        format <> 'individual'::public.competition_format
        or (
          max_participants between 3 and 100
          and participants_per_team is null
          and max_teams is null
        )
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_scheduled_team_capacity_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_scheduled_team_capacity_chk
      check (
        format <> 'team'::public.competition_format
        or (
          type = 'scheduled'::public.competition_type
          and participants_per_team between 2 and 5
          and max_teams between 3 and 50
          and max_participants is null
        )
      ) not valid;
  end if;
end;
$$;

create index if not exists competitions_active_name_lookup_idx
  on public.competitions (organizer_id, lower(name))
  where is_deleted = false
    and status in (
      'draft'::public.competition_status,
      'published'::public.competition_status,
      'live'::public.competition_status,
      'paused'::public.competition_status,
      'ended'::public.competition_status
    );

create index if not exists competitions_status_idx
  on public.competitions (status, is_deleted);

-- Keep canonical status and legacy booleans synchronized while enforcing branch-08 transitions.
create or replace function public.competition_lifecycle_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_status_from_legacy public.competition_status;
  v_has_active_attempts boolean := false;
  v_draft_fields_changed boolean := false;
begin
  new.updated_at := v_now;
  new.is_deleted := coalesce(new.is_deleted, false);
  new.answer_key_visibility := coalesce(new.answer_key_visibility, 'after_end'::public.answer_key_visibility);
  new.draft_revision := greatest(coalesce(new.draft_revision, 1), 1);
  new.draft_version := greatest(coalesce(new.draft_version, 1), 1);

  if tg_op = 'INSERT' then
    v_status_from_legacy := case
      when coalesce(new.is_paused, false) then 'paused'::public.competition_status
      when coalesce(new.published, false) then 'published'::public.competition_status
      else 'draft'::public.competition_status
    end;
  else
    v_status_from_legacy := case
      when coalesce(new.is_paused, false) then 'paused'::public.competition_status
      when coalesce(new.published, false) then
        case
          when old.status in (
            'live'::public.competition_status,
            'paused'::public.competition_status
          ) then 'live'::public.competition_status
          when old.status in (
            'ended'::public.competition_status,
            'archived'::public.competition_status
          ) then old.status
          else 'published'::public.competition_status
        end
      else 'draft'::public.competition_status
    end;
  end if;

  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := v_status_from_legacy;
    end if;
  else
    if new.status is null then
      new.status := old.status;
    end if;

    if new.status is not distinct from old.status
       and (
         new.published is distinct from old.published
         or new.is_paused is distinct from old.is_paused
       ) then
      new.status := v_status_from_legacy;
    end if;

    if old.status is distinct from new.status then
      if not (
        (old.status = 'draft'::public.competition_status and new.status = 'published'::public.competition_status)
        or (old.status = 'published'::public.competition_status and new.status = 'live'::public.competition_status)
        or (old.status = 'live'::public.competition_status and new.status = 'paused'::public.competition_status)
        or (old.status = 'paused'::public.competition_status and new.status = 'live'::public.competition_status)
        or (old.status in ('live'::public.competition_status, 'paused'::public.competition_status) and new.status = 'ended'::public.competition_status)
        or (old.status = 'ended'::public.competition_status and new.status = 'archived'::public.competition_status)
        or (old.status = 'paused'::public.competition_status and new.status = 'archived'::public.competition_status)
      ) then
        raise exception 'invalid_competition_status_transition:%->%', old.status, new.status;
      end if;

      if old.status = 'paused'::public.competition_status
         and new.status = 'archived'::public.competition_status then
        if old.type <> 'open'::public.competition_type then
          raise exception 'archive_requires_open_paused_competition';
        end if;

        if to_regclass('public.competition_attempts') is not null then
          execute
            'select exists (
               select 1
               from public.competition_attempts
               where competition_id = $1
                 and status = ''in_progress''
             )'
          into v_has_active_attempts
          using old.id;
        end if;

        if v_has_active_attempts then
          raise exception 'archive_requires_no_active_attempts';
        end if;
      end if;
    end if;

    if old.status <> 'draft'::public.competition_status
       and new.scoring_snapshot_json is distinct from old.scoring_snapshot_json then
      raise exception 'scoring_snapshot_json_immutable_after_publish';
    end if;

    v_draft_fields_changed :=
      new.name is distinct from old.name
      or new.description is distinct from old.description
      or new.instructions is distinct from old.instructions
      or new.type is distinct from old.type
      or new.format is distinct from old.format
      or new.registration_start is distinct from old.registration_start
      or new.registration_end is distinct from old.registration_end
      or new.start_time is distinct from old.start_time
      or new.end_time is distinct from old.end_time
      or new.duration_minutes is distinct from old.duration_minutes
      or new.attempts_allowed is distinct from old.attempts_allowed
      or new.max_participants is distinct from old.max_participants
      or new.participants_per_team is distinct from old.participants_per_team
      or new.max_teams is distinct from old.max_teams
      or new.scoring_mode is distinct from old.scoring_mode
      or new.custom_points is distinct from old.custom_points
      or new.penalty_mode is distinct from old.penalty_mode
      or new.deduction_value is distinct from old.deduction_value
      or new.tie_breaker is distinct from old.tie_breaker
      or new.multi_attempt_grading_mode is distinct from old.multi_attempt_grading_mode
      or new.shuffle_questions is distinct from old.shuffle_questions
      or new.shuffle_options is distinct from old.shuffle_options
      or new.log_tab_switch is distinct from old.log_tab_switch
      or new.offense_penalties is distinct from old.offense_penalties
      or new.answer_key_visibility is distinct from old.answer_key_visibility
      or new.status is distinct from old.status
      or new.is_deleted is distinct from old.is_deleted;

    new.draft_revision := coalesce(new.draft_revision, old.draft_revision);
    new.draft_version := coalesce(new.draft_version, old.draft_version);
  end if;

  new.published := new.status in (
    'published'::public.competition_status,
    'live'::public.competition_status,
    'paused'::public.competition_status,
    'ended'::public.competition_status,
    'archived'::public.competition_status
  );
  new.is_paused := new.status = 'paused'::public.competition_status;

  if new.status = 'draft'::public.competition_status then
    new.published_at := null;
  elsif new.published_at is null and new.published then
    new.published_at := v_now;
  end if;

  return new;
end;
$$;

create or replace function public.competition_active_name_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.is_deleted, false) = false
     and new.status in (
       'draft'::public.competition_status,
       'published'::public.competition_status,
       'live'::public.competition_status,
       'paused'::public.competition_status,
       'ended'::public.competition_status
     ) then
    if exists (
      select 1
      from public.competitions c
      where c.organizer_id = new.organizer_id
        and lower(c.name) = lower(new.name)
        and c.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and c.is_deleted = false
        and c.status in (
          'draft'::public.competition_status,
          'published'::public.competition_status,
          'live'::public.competition_status,
          'paused'::public.competition_status,
          'ended'::public.competition_status
        )
      limit 1
    ) then
      raise exception 'duplicate_competition_name_active' using errcode = '23505';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_08_competitions_10_lifecycle_guard on public.competitions;
create trigger trg_08_competitions_10_lifecycle_guard
before insert or update on public.competitions
for each row
execute function public.competition_lifecycle_guard();

drop trigger if exists trg_08_competitions_20_name_guard on public.competitions;
create trigger trg_08_competitions_20_name_guard
before insert or update on public.competitions
for each row
execute function public.competition_active_name_guard();

-- Harden competition problem snapshots with frozen publish-time fields.
alter table public.competition_problems
  add column if not exists content_snapshot_latex text,
  add column if not exists options_snapshot_json jsonb,
  add column if not exists answer_key_snapshot_json jsonb,
  add column if not exists explanation_snapshot_latex text,
  add column if not exists difficulty_snapshot public.difficulty,
  add column if not exists tags_snapshot text[],
  add column if not exists image_snapshot_path text;

update public.competition_problems cp
set points = coalesce(cp.points, 1),
    content_snapshot_latex = coalesce(cp.content_snapshot_latex, p.content_latex, p.content),
    options_snapshot_json = coalesce(cp.options_snapshot_json, p.options_json, p.options),
    answer_key_snapshot_json = coalesce(cp.answer_key_snapshot_json, p.answer_key_json, p.answers),
    explanation_snapshot_latex = coalesce(cp.explanation_snapshot_latex, p.explanation_latex),
    difficulty_snapshot = coalesce(cp.difficulty_snapshot, p.difficulty),
    tags_snapshot = coalesce(cp.tags_snapshot, p.tags),
    image_snapshot_path = coalesce(cp.image_snapshot_path, p.image_path, p.image_url)
from public.problems p
where cp.problem_id = p.id
  and (
    cp.points is null
    or cp.content_snapshot_latex is null
    or cp.options_snapshot_json is null
    or cp.answer_key_snapshot_json is null
    or cp.explanation_snapshot_latex is null
    or cp.difficulty_snapshot is null
    or cp.tags_snapshot is null
    or cp.image_snapshot_path is null
  );

do $$
begin
  if not exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'competition_problems_competition_order_uq'
      and n.nspname = 'public'
  ) then
    if not exists (
      select 1
      from (
        select competition_id, order_index
        from public.competition_problems
        where order_index is not null
        group by competition_id, order_index
        having count(*) > 1
      ) dup
    ) then
      create unique index competition_problems_competition_order_uq
        on public.competition_problems (competition_id, order_index)
        where order_index is not null;
    else
      create index if not exists competition_problems_competition_order_idx
        on public.competition_problems (competition_id, order_index)
        where order_index is not null;
    end if;
  end if;
end;
$$;

create or replace function public.competition_problem_snapshot_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_competition_id uuid;
  v_comp_status public.competition_status;
begin
  if tg_op = 'DELETE' then
    v_competition_id := old.competition_id;
  else
    v_competition_id := new.competition_id;
  end if;

  select status
  into v_comp_status
  from public.competitions
  where id = v_competition_id;

  if not found then
    raise exception 'competition_not_found_for_problem_snapshot';
  end if;

  if tg_op = 'DELETE' then
    if v_comp_status in (
      'published'::public.competition_status,
      'live'::public.competition_status,
      'paused'::public.competition_status,
      'ended'::public.competition_status,
      'archived'::public.competition_status
    ) then
      raise exception 'competition_problem_snapshot_immutable';
    end if;

    return old;
  end if;

  if new.points is null then
    new.points := 1;
  end if;

  if tg_op = 'INSERT' then
    if v_comp_status <> 'draft'::public.competition_status then
      if new.content_snapshot_latex is null
         or new.answer_key_snapshot_json is null
         or new.points is null then
        raise exception 'published_problem_snapshot_requires_frozen_fields';
      end if;
    end if;

    return new;
  end if;

  if v_comp_status in (
    'published'::public.competition_status,
    'live'::public.competition_status,
    'paused'::public.competition_status,
    'ended'::public.competition_status,
    'archived'::public.competition_status
  ) and (
    new.points is distinct from old.points
    or new.problem_id is distinct from old.problem_id
    or new.order_index is distinct from old.order_index
    or new.content_snapshot_latex is distinct from old.content_snapshot_latex
    or new.options_snapshot_json is distinct from old.options_snapshot_json
    or new.answer_key_snapshot_json is distinct from old.answer_key_snapshot_json
    or new.explanation_snapshot_latex is distinct from old.explanation_snapshot_latex
    or new.difficulty_snapshot is distinct from old.difficulty_snapshot
    or new.tags_snapshot is distinct from old.tags_snapshot
    or new.image_snapshot_path is distinct from old.image_snapshot_path
  ) then
    raise exception 'competition_problem_snapshot_immutable';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_08_competition_problems_snapshot_guard on public.competition_problems;
create trigger trg_08_competition_problems_snapshot_guard
before insert or update or delete on public.competition_problems
for each row
execute function public.competition_problem_snapshot_guard();

-- Harden competition events for lifecycle payload/metadata and deterministic idempotency.
alter table public.competition_events
  alter column actor_user_id drop not null,
  add column if not exists control_action text default 'legacy_event',
  add column if not exists request_idempotency_token text,
  add column if not exists payload_hash text,
  add column if not exists payload_json jsonb default '{}'::jsonb,
  add column if not exists metadata_json jsonb default '{}'::jsonb;

alter table public.competition_events
  alter column control_action set default 'legacy_event',
  alter column payload_json set default '{}'::jsonb,
  alter column metadata_json set default '{}'::jsonb;

update public.competition_events
set control_action = coalesce(nullif(btrim(control_action), ''), event_type, 'legacy_event'),
    payload_hash = coalesce(
      payload_hash,
      encode(extensions.digest(coalesce(payload_json, '{}'::jsonb)::text, 'sha256'), 'hex')
    ),
    payload_json = coalesce(payload_json, '{}'::jsonb),
    metadata_json = coalesce(metadata_json, '{}'::jsonb)
where control_action is null
   or nullif(btrim(control_action), '') is null
   or payload_hash is null
   or payload_json is null
   or metadata_json is null;

alter table public.competition_events
  alter column control_action set not null,
  alter column payload_json set not null,
  alter column metadata_json set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_events_control_action_not_blank_chk'
      and conrelid = 'public.competition_events'::regclass
  ) then
    alter table public.competition_events
      add constraint competition_events_control_action_not_blank_chk
      check (nullif(btrim(control_action), '') is not null) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_events_payload_hash_hex_chk'
      and conrelid = 'public.competition_events'::regclass
  ) then
    alter table public.competition_events
      add constraint competition_events_payload_hash_hex_chk
      check (
        payload_hash is null
        or payload_hash ~ '^[0-9a-f]{64}$'
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competition_events_request_token_not_blank_chk'
      and conrelid = 'public.competition_events'::regclass
  ) then
    alter table public.competition_events
      add constraint competition_events_request_token_not_blank_chk
      check (
        request_idempotency_token is null
        or nullif(btrim(request_idempotency_token), '') is not null
      ) not valid;
  end if;
end;
$$;

create index if not exists competition_events_competition_action_idx
  on public.competition_events (competition_id, control_action, happened_at desc);

create unique index if not exists competition_events_idempotency_uq
  on public.competition_events (
    competition_id,
    control_action,
    coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    request_idempotency_token
  )
  where request_idempotency_token is not null;

-- Trusted helper to freeze selected problems into immutable competition snapshots.
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
  set points = coalesce(
        cp.points,
        case coalesce(p.difficulty, cp.difficulty_snapshot)
          when 'easy'::public.difficulty then 1
          when 'average'::public.difficulty then 2
          when 'difficult'::public.difficulty then 3
          else 1
        end
      ),
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

create or replace function public.publish_competition(
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
  v_snapshot_machine_code text;
  v_snapshot_selected_count bigint;
  v_snapshot_count bigint;
  v_snapshot_hash text;
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
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object('request_idempotency_token', v_token);
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:publish:'
      || p_competition_id::text
      || ':'
      || coalesce(v_actor_user_id::text, '00000000-0000-0000-0000-000000000000')
      || ':'
      || v_token
    )
  );

  select *
  into v_event
  from public.competition_events
  where competition_id = p_competition_id
    and control_action = 'publish_competition'
    and coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and request_idempotency_token = v_token
  order by happened_at desc, id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_published'
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

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.status <> 'draft'::public.competition_status then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  select
    s.machine_code,
    s.selected_problem_count,
    s.snapshotted_count,
    s.snapshot_hash
  into
    v_snapshot_machine_code,
    v_snapshot_selected_count,
    v_snapshot_count,
    v_snapshot_hash
  from public.snapshot_competition_problems(p_competition_id) s
  limit 1;

  if v_snapshot_machine_code is distinct from 'ok' then
    return query
      select coalesce(v_snapshot_machine_code, 'snapshot_failed'), p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions
  set status = 'published'::public.competition_status,
      scoring_snapshot_json = coalesce(
        scoring_snapshot_json,
        jsonb_build_object(
          'scoring_mode', scoring_mode,
          'custom_points', custom_points,
          'penalty_mode', penalty_mode,
          'deduction_value', deduction_value,
          'tie_breaker', tie_breaker,
          'multi_attempt_grading_mode', multi_attempt_grading_mode,
          'attempts_allowed', attempts_allowed,
          'shuffle_questions', shuffle_questions,
          'shuffle_options', shuffle_options,
          'log_tab_switch', log_tab_switch,
          'offense_penalties', offense_penalties,
          'answer_key_visibility', answer_key_visibility
        )
      ),
      published_at = coalesce(published_at, timezone('utc', now())),
      updated_at = timezone('utc', now())
  where id = p_competition_id
  returning status
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
    'competition_published',
    v_actor_user_id,
    'publish_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'published',
      'selected_problem_count', v_snapshot_selected_count,
      'snapshotted_count', v_snapshot_count,
      'snapshot_hash', v_snapshot_hash,
      'target_status', 'published'
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;

create or replace function public.start_competition(
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
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object('request_idempotency_token', v_token);
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:start:'
      || p_competition_id::text
      || ':'
      || coalesce(v_actor_user_id::text, '00000000-0000-0000-0000-000000000000')
      || ':'
      || v_token
    )
  );

  select *
  into v_event
  from public.competition_events
  where competition_id = p_competition_id
    and control_action = 'start_competition'
    and coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and request_idempotency_token = v_token
  order by happened_at desc, id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_started'
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

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.status <> 'published'::public.competition_status then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions
  set status = 'live'::public.competition_status,
      updated_at = timezone('utc', now())
  where id = p_competition_id
  returning status
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
    'competition_started',
    v_actor_user_id,
    'start_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'live',
      'target_status', 'live'
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;

create or replace function public.end_competition(
  p_competition_id uuid,
  p_reason text,
  p_request_idempotency_token text,
  p_transition_source text
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
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_transition_source text := lower(btrim(coalesce(p_transition_source, '')));
  v_effective_end_at timestamptz;
  v_system_token text;
  v_payload jsonb;
  v_payload_hash text;
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

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
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

  if v_competition.type = 'scheduled'::public.competition_type then
    if v_transition_source <> 'system_timer' then
      return query
        select 'scheduled_requires_system_timer', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if v_reason is not null then
      return query
        select 'reason_not_allowed_for_system_timer', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    v_effective_end_at := coalesce(
      v_competition.end_time,
      case
        when v_competition.start_time is null then null
        else v_competition.start_time + make_interval(mins => coalesce(v_competition.duration_minutes, 0))
      end
    );

    v_system_token :=
      'system_end:'
      || p_competition_id::text
      || ':'
      || to_char(
           coalesce(v_effective_end_at, timezone('utc', now())) at time zone 'utc',
           'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
         );

    if v_token = '' then
      v_token := v_system_token;
    end if;

    if v_token <> v_system_token then
      return query
        select 'invalid_system_timer_token', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    v_actor_user_id := null;
  elsif v_competition.type = 'open'::public.competition_type then
    if v_transition_source <> 'trusted_manual_action' then
      return query
        select 'open_requires_trusted_manual_action', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if v_reason is null then
      return query
        select 'reason_required', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;

    if v_token = '' then
      return query
        select 'request_idempotency_token_required', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
      return;
    end if;
  else
    return query
      select 'unsupported_competition_type', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object(
    'request_idempotency_token', v_token,
    'transition_source', v_transition_source,
    'reason_text', v_reason
  );
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:end:'
      || p_competition_id::text
      || ':'
      || coalesce(v_actor_user_id::text, '00000000-0000-0000-0000-000000000000')
      || ':'
      || v_token
    )
  );

  select *
  into v_event
  from public.competition_events
  where competition_id = p_competition_id
    and control_action = 'end_competition'
    and coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and request_idempotency_token = v_token
  order by happened_at desc, id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_ended'
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

  if v_competition.status not in (
    'live'::public.competition_status,
    'paused'::public.competition_status
  ) then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions
  set status = 'ended'::public.competition_status,
      updated_at = timezone('utc', now())
  where id = p_competition_id
  returning status
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
    'competition_ended',
    v_actor_user_id,
    'end_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', 'ended',
      'target_status', 'ended',
      'transition_source', v_transition_source
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
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
  from public.competitions
  where id = p_competition_id
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
  from public.competition_events
  where competition_id = p_competition_id
    and control_action = 'archive_competition'
    and coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and request_idempotency_token = v_token
  order by happened_at desc, id desc
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
           from public.competition_attempts
           where competition_id = $1
             and status = ''in_progress''
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

  update public.competitions
  set status = 'archived'::public.competition_status,
      updated_at = timezone('utc', now())
  where id = p_competition_id
  returning status
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

create or replace function public.delete_draft_competition(
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
  v_has_registered boolean := false;
  v_has_attempts boolean := false;
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
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::uuid, v_token, false, false;
    return;
  end if;

  v_payload := jsonb_build_object('request_idempotency_token', v_token);
  v_payload_hash := encode(extensions.digest(v_payload::text, 'sha256'), 'hex');

  perform pg_advisory_xact_lock(
    hashtext(
      'competition_lifecycle:delete_draft:'
      || p_competition_id::text
      || ':'
      || coalesce(v_actor_user_id::text, '00000000-0000-0000-0000-000000000000')
      || ':'
      || v_token
    )
  );

  select *
  into v_event
  from public.competition_events
  where competition_id = p_competition_id
    and control_action = 'delete_draft_competition'
    and coalesce(actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(v_actor_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and request_idempotency_token = v_token
  order by happened_at desc, id desc
  limit 1;

  if found then
    if v_event.event_type = 'competition_draft_deleted'
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

  if v_competition.status <> 'draft'::public.competition_status then
    return query
      select 'draft_only_delete', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'already_deleted', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if to_regclass('public.competition_registrations') is not null then
    execute
      'select exists (
         select 1
         from public.competition_registrations
         where competition_id = $1
           and status = ''registered''
       )'
    into v_has_registered
    using p_competition_id;
  end if;

  if v_has_registered then
    return query
      select 'has_active_registrations', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  if to_regclass('public.competition_attempts') is not null then
    execute
      'select exists (
         select 1
         from public.competition_attempts
         where competition_id = $1
       )'
    into v_has_attempts
    using p_competition_id;
  end if;

  if v_has_attempts then
    return query
      select 'has_attempt_history', p_competition_id, v_competition.status, null::uuid, v_token, false, false;
    return;
  end if;

  update public.competitions
  set is_deleted = true,
      updated_at = timezone('utc', now())
  where id = p_competition_id
  returning status
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
    'competition_draft_deleted',
    v_actor_user_id,
    'delete_draft_competition',
    v_token,
    v_payload_hash,
    v_payload,
    jsonb_build_object(
      'machine_code', 'ok',
      'result_status', v_competition.status::text,
      'is_deleted', true
    )
  )
  returning id into v_event_id;

  return query
    select 'ok', p_competition_id, v_competition.status, v_event_id, v_token, false, true;
end;
$$;

create or replace function public.save_competition_draft(
  p_competition_id uuid,
  p_expected_draft_revision integer,
  p_payload_json jsonb
)
returns table (
  machine_code text,
  competition_id uuid,
  status public.competition_status,
  draft_revision integer,
  draft_version integer,
  selected_problem_count bigint,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_competition public.competitions%rowtype;
  v_payload jsonb := coalesce(p_payload_json, '{}'::jsonb);
  v_now timestamptz := timezone('utc', now());
  v_selected_problem_count bigint := 0;
  v_selected_ids jsonb;
begin
  if auth.role() <> 'service_role' then
    return query
      select 'forbidden', p_competition_id, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  if p_competition_id is null then
    return query
      select 'competition_id_required', null::uuid, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  if p_expected_draft_revision is null or p_expected_draft_revision < 1 then
    return query
      select 'draft_revision_required', p_competition_id, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id
  for update;

  if not found then
    return query
      select 'not_found', p_competition_id, null::public.competition_status, null::integer, null::integer, 0::bigint, null::timestamptz;
    return;
  end if;

  if v_competition.is_deleted then
    return query
      select 'deleted', p_competition_id, v_competition.status, v_competition.draft_revision, v_competition.draft_version, 0::bigint, v_competition.updated_at;
    return;
  end if;

  if v_competition.status <> 'draft'::public.competition_status then
    return query
      select 'invalid_transition', p_competition_id, v_competition.status, v_competition.draft_revision, v_competition.draft_version, 0::bigint, v_competition.updated_at;
    return;
  end if;

  if coalesce(v_competition.draft_revision, 1) <> p_expected_draft_revision then
    return query
      select 'draft_write_conflict', p_competition_id, v_competition.status, v_competition.draft_revision, v_competition.draft_version, 0::bigint, v_competition.updated_at;
    return;
  end if;

  if v_payload ? 'selectedProblemIds' then
    delete from public.competition_problems
    where competition_id = p_competition_id;

    v_selected_ids := case
      when jsonb_typeof(v_payload -> 'selectedProblemIds') = 'array' then v_payload -> 'selectedProblemIds'
      else '[]'::jsonb
    end;

    with selected_problem_ids as (
      select nullif(btrim(value), '') as problem_id, ordinality
      from jsonb_array_elements_text(coalesce(v_selected_ids, '[]'::jsonb)) with ordinality as entries(value, ordinality)
    ),
    deduped_problem_ids as (
      select problem_id, min(ordinality) as ordinality
      from selected_problem_ids
      where problem_id is not null
      group by problem_id
    )
    insert into public.competition_problems (
      competition_id,
      problem_id,
      order_index,
      points
    )
    select
      p_competition_id,
      deduped_problem_ids.problem_id::uuid,
      deduped_problem_ids.ordinality::integer,
      null
    from deduped_problem_ids
    order by deduped_problem_ids.ordinality;

    select count(*)
    into v_selected_problem_count
    from public.competition_problems
    where competition_id = p_competition_id;
  else
    select count(*)
    into v_selected_problem_count
    from public.competition_problems
    where competition_id = p_competition_id;
  end if;

  update public.competitions
  set name = case when v_payload ? 'name' then nullif(btrim(coalesce(v_payload ->> 'name', name)), '') else name end,
      description = case when v_payload ? 'description' then coalesce(v_payload ->> 'description', description) else description end,
      instructions = case when v_payload ? 'instructions' then coalesce(v_payload ->> 'instructions', instructions) else instructions end,
      type = case when v_payload ? 'type' then (v_payload ->> 'type')::public.competition_type else type end,
      format = case when v_payload ? 'format' then (v_payload ->> 'format')::public.competition_format else format end,
      registration_start = case
        when v_payload ? 'registrationStart' then nullif(v_payload ->> 'registrationStart', '')::timestamptz
        else registration_start
      end,
      registration_end = case
        when v_payload ? 'registrationEnd' then nullif(v_payload ->> 'registrationEnd', '')::timestamptz
        else registration_end
      end,
      start_time = case
        when v_payload ? 'startTime' then nullif(v_payload ->> 'startTime', '')::timestamptz
        else start_time
      end,
      end_time = case
        when v_payload ? 'endTime' then nullif(v_payload ->> 'endTime', '')::timestamptz
        else end_time
      end,
      duration_minutes = case
        when v_payload ? 'durationMinutes' then nullif(v_payload ->> 'durationMinutes', '')::integer
        else duration_minutes
      end,
      attempts_allowed = case
        when v_payload ? 'attemptsAllowed' then nullif(v_payload ->> 'attemptsAllowed', '')::integer
        else attempts_allowed
      end,
      multi_attempt_grading_mode = case
        when v_payload ? 'multiAttemptGradingMode' then (v_payload ->> 'multiAttemptGradingMode')::public.attempt_grading_mode
        else multi_attempt_grading_mode
      end,
      max_participants = case
        when v_payload ? 'maxParticipants' then nullif(v_payload ->> 'maxParticipants', '')::integer
        else max_participants
      end,
      participants_per_team = case
        when v_payload ? 'participantsPerTeam' then nullif(v_payload ->> 'participantsPerTeam', '')::integer
        else participants_per_team
      end,
      max_teams = case
        when v_payload ? 'maxTeams' then nullif(v_payload ->> 'maxTeams', '')::integer
        else max_teams
      end,
      scoring_mode = case
        when v_payload ? 'scoringMode' then (v_payload ->> 'scoringMode')::public.scoring_mode
        else scoring_mode
      end,
      custom_points = case
        when v_payload ? 'customPoints' then coalesce(v_payload -> 'customPoints', '{}'::jsonb)
        else custom_points
      end,
      penalty_mode = case
        when v_payload ? 'penaltyMode' then (v_payload ->> 'penaltyMode')::public.penalty_mode
        else penalty_mode
      end,
      deduction_value = case
        when v_payload ? 'deductionValue' then nullif(v_payload ->> 'deductionValue', '')::integer
        else deduction_value
      end,
      tie_breaker = case
        when v_payload ? 'tieBreaker' then (v_payload ->> 'tieBreaker')::public.tie_breaker
        else tie_breaker
      end,
      shuffle_questions = case
        when v_payload ? 'shuffleQuestions' then coalesce((v_payload ->> 'shuffleQuestions')::boolean, shuffle_questions)
        else shuffle_questions
      end,
      shuffle_options = case
        when v_payload ? 'shuffleOptions' then coalesce((v_payload ->> 'shuffleOptions')::boolean, shuffle_options)
        else shuffle_options
      end,
      log_tab_switch = case
        when v_payload ? 'logTabSwitch' then coalesce((v_payload ->> 'logTabSwitch')::boolean, log_tab_switch)
        else log_tab_switch
      end,
      offense_penalties = case
        when v_payload ? 'offensePenalties' then coalesce(v_payload -> 'offensePenalties', '[]'::jsonb)
        else offense_penalties
      end,
      answer_key_visibility = case
        when v_payload ? 'answerKeyVisibility' then (v_payload ->> 'answerKeyVisibility')::public.answer_key_visibility
        else answer_key_visibility
      end,
      draft_revision = coalesce(v_competition.draft_revision, 1) + 1,
      draft_version = coalesce(v_competition.draft_revision, 1) + 1,
      updated_at = v_now
  where id = p_competition_id;

  select *
  into v_competition
  from public.competitions
  where id = p_competition_id;

  return query
    select
      'ok',
      p_competition_id,
      v_competition.status,
      v_competition.draft_revision,
      v_competition.draft_version,
      v_selected_problem_count,
      v_competition.updated_at;
end;
$$;

revoke all on function public.snapshot_competition_problems(uuid) from public;
revoke all on function public.publish_competition(uuid, text) from public;
revoke all on function public.start_competition(uuid, text) from public;
revoke all on function public.end_competition(uuid, text, text, text) from public;
revoke all on function public.archive_competition(uuid, text) from public;
revoke all on function public.delete_draft_competition(uuid, text) from public;
revoke all on function public.save_competition_draft(uuid, integer, jsonb) from public;

grant execute on function public.snapshot_competition_problems(uuid) to service_role;
grant execute on function public.publish_competition(uuid, text) to service_role;
grant execute on function public.start_competition(uuid, text) to service_role;
grant execute on function public.end_competition(uuid, text, text, text) to service_role;
grant execute on function public.archive_competition(uuid, text) to service_role;
grant execute on function public.delete_draft_competition(uuid, text) to service_role;
grant execute on function public.save_competition_draft(uuid, integer, jsonb) to service_role;

commit;
