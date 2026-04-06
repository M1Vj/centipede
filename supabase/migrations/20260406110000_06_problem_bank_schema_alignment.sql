begin;

alter table public.problem_banks
  add column if not exists is_default_bank boolean default false,
  add column if not exists is_visible_to_organizers boolean default false,
  add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.problems
  add column if not exists content_latex text,
  add column if not exists content_html text,
  add column if not exists options_json jsonb,
  add column if not exists answer_key_json jsonb,
  add column if not exists explanation_latex text,
  add column if not exists image_path text,
  add column if not exists authoring_notes text,
  add column if not exists updated_at timestamptz default timezone('utc', now());

alter table public.problem_banks
  alter column is_default_bank set default false,
  alter column is_visible_to_organizers set default false,
  alter column updated_at set default timezone('utc', now());

alter table public.problems
  alter column updated_at set default timezone('utc', now());

alter table public.problem_banks
  alter column is_default_bank set not null,
  alter column is_visible_to_organizers set not null,
  alter column updated_at set not null;

alter table public.problems
  alter column content_latex set not null,
  alter column answer_key_json set not null,
  alter column updated_at set not null;

update public.problem_banks
set is_default_bank = coalesce(is_default_bank, false),
    is_visible_to_organizers = coalesce(is_visible_to_organizers, false),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where is_default_bank is null
   or is_visible_to_organizers is null
   or updated_at is null;

update public.problems
set content_latex = coalesce(content_latex, content),
    content_html = coalesce(content_html, content, content_latex),
    options_json = coalesce(options_json, options),
    answer_key_json = coalesce(answer_key_json, answers),
    image_path = coalesce(image_path, image_url),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where content_latex is null
   or content_html is null
   or (options_json is null and options is not null)
   or answer_key_json is null
   or (image_path is null and image_url is not null)
   or updated_at is null;

create or replace function public.problem_bank_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.sync_problem_legacy_and_canonical_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.content_latex is null and new.content is not null then
    new.content_latex := new.content;
  end if;

  if new.content is null and new.content_latex is not null then
    new.content := new.content_latex;
  end if;

  if new.content_html is null then
    new.content_html := coalesce(new.content_latex, new.content);
  end if;

  if new.options_json is null and new.options is not null then
    new.options_json := new.options;
  end if;

  if new.options is null and new.options_json is not null then
    new.options := new.options_json;
  end if;

  if new.answer_key_json is null and new.answers is not null then
    new.answer_key_json := new.answers;
  end if;

  if new.answers is null and new.answer_key_json is not null then
    new.answers := new.answer_key_json;
  end if;

  if new.image_path is null and new.image_url is not null then
    new.image_path := new.image_url;
  end if;

  if new.image_url is null and new.image_path is not null then
    new.image_url := new.image_path;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_problem_bank_hard_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'Hard delete is not allowed on %. Set is_deleted = true instead.', tg_table_name;
end;
$$;

drop trigger if exists trg_06_problem_banks_set_updated_at on public.problem_banks;
create trigger trg_06_problem_banks_set_updated_at
before update on public.problem_banks
for each row
execute function public.problem_bank_set_updated_at();

drop trigger if exists trg_06_problems_00_sync_legacy on public.problems;
create trigger trg_06_problems_00_sync_legacy
before insert or update on public.problems
for each row
execute function public.sync_problem_legacy_and_canonical_columns();

drop trigger if exists trg_06_problems_10_set_updated_at on public.problems;
create trigger trg_06_problems_10_set_updated_at
before update on public.problems
for each row
execute function public.problem_bank_set_updated_at();

drop trigger if exists trg_06_problem_banks_prevent_hard_delete on public.problem_banks;
create trigger trg_06_problem_banks_prevent_hard_delete
before delete on public.problem_banks
for each row
execute function public.prevent_problem_bank_hard_delete();

drop trigger if exists trg_06_problems_prevent_hard_delete on public.problems;
create trigger trg_06_problems_prevent_hard_delete
before delete on public.problems
for each row
execute function public.prevent_problem_bank_hard_delete();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_banks_description_word_cap_200_chk'
      and conrelid = 'public.problem_banks'::regclass
  ) then
    alter table public.problem_banks
      add constraint problem_banks_description_word_cap_200_chk
      check (
        description is null
        or coalesce(
          array_length(
            regexp_split_to_array(
              nullif(regexp_replace(trim(description), '\s+', ' ', 'g'), ''),
              ' '
            ),
            1
          ),
          0
        ) <= 200
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_banks_name_not_blank_chk'
      and conrelid = 'public.problem_banks'::regclass
  ) then
    alter table public.problem_banks
      add constraint problem_banks_name_not_blank_chk
      check (nullif(btrim(name), '') is not null) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problems_answer_key_json_object_chk'
      and conrelid = 'public.problems'::regclass
  ) then
    alter table public.problems
      add constraint problems_answer_key_json_object_chk
      check (
        answer_key_json is null
        or jsonb_typeof(answer_key_json) = 'object'
      ) not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problems_mcq_tf_options_presence_chk'
      and conrelid = 'public.problems'::regclass
  ) then
    alter table public.problems
      add constraint problems_mcq_tf_options_presence_chk
      check (
        type not in ('mcq'::public.problem_type, 'tf'::public.problem_type)
        or (
          options_json is not null
          and jsonb_typeof(options_json) = 'array'
        )
      ) not valid;
  end if;
end;
$$;

create unique index if not exists problem_banks_active_owner_name_uq
  on public.problem_banks (organizer_id, lower(name))
  where is_deleted = false;

create index if not exists problem_banks_organizer_deleted_idx
  on public.problem_banks (organizer_id, is_deleted);

create index if not exists problem_banks_default_visible_idx
  on public.problem_banks (is_default_bank, is_visible_to_organizers)
  where is_deleted = false;

create index if not exists problems_bank_idx
  on public.problems (bank_id);

create index if not exists problems_tags_gin_idx
  on public.problems using gin (tags);

commit;