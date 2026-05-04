alter table public.competitions
  add column if not exists safe_exam_browser_mode text not null default 'off',
  add column if not exists safe_exam_browser_config_key_hashes text[] not null default '{}'::text[];

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_safe_exam_browser_mode_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_safe_exam_browser_mode_chk
      check (safe_exam_browser_mode in ('off', 'required'));
  end if;
end $$;

alter table public.competitions
  validate constraint competitions_safe_exam_browser_mode_chk;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'competitions_safe_exam_browser_required_hashes_chk'
      and conrelid = 'public.competitions'::regclass
  ) then
    alter table public.competitions
      add constraint competitions_safe_exam_browser_required_hashes_chk
      check (
        safe_exam_browser_mode <> 'required'
        or coalesce(array_length(safe_exam_browser_config_key_hashes, 1), 0) > 0
      );
  end if;
end $$;

alter table public.competitions
  validate constraint competitions_safe_exam_browser_required_hashes_chk;
