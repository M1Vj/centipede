begin;

alter table public.problem_banks enable row level security;
alter table public.problems enable row level security;

grant select, insert, update on public.problem_banks to authenticated;
grant select, insert, update on public.problems to authenticated;
grant all privileges on public.problem_banks to service_role;
grant all privileges on public.problems to service_role;

revoke delete on public.problem_banks from anon;
revoke delete on public.problem_banks from authenticated;
revoke delete on public.problems from anon;
revoke delete on public.problems from authenticated;

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'problem_banks'
  loop
    execute format('drop policy if exists %I on public.problem_banks', policy_record.policyname);
  end loop;

  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'problems'
  loop
    execute format('drop policy if exists %I on public.problems', policy_record.policyname);
  end loop;
end;
$$;

create policy "problem_banks_select_branch06"
on public.problem_banks
for select
using (
  public.jwt_is_admin()
  or (
    organizer_id = auth.uid()
    and is_deleted = false
  )
  or (
    coalesce(is_default_bank, false) = true
    and coalesce(is_visible_to_organizers, false) = true
    and is_deleted = false
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'organizer'
        and p.is_active = true
    )
  )
);

create policy "problem_banks_insert_branch06"
on public.problem_banks
for insert
with check (
  (
    organizer_id = auth.uid()
    and coalesce(is_deleted, false) = false
    and coalesce(is_default_bank, false) = false
  )
  or (
    public.jwt_is_admin()
    and organizer_id = auth.uid()
    and coalesce(is_deleted, false) = false
    and coalesce(is_default_bank, false) = true
  )
);

create policy "problem_banks_update_branch06"
on public.problem_banks
for update
using (
  (
    organizer_id = auth.uid()
    and is_deleted = false
    and coalesce(is_default_bank, false) = false
  )
  or (
    public.jwt_is_admin()
    and coalesce(is_default_bank, false) = true
  )
)
with check (
  (
    organizer_id = auth.uid()
    and coalesce(is_default_bank, false) = false
  )
  or (
    public.jwt_is_admin()
    and coalesce(is_default_bank, false) = true
  )
);

create policy "problems_select_branch06"
on public.problems
for select
using (
  public.jwt_is_admin()
  or (
    is_deleted = false
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.organizer_id = auth.uid()
        and pb.is_deleted = false
    )
  )
  or (
    is_deleted = false
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = true
        and coalesce(pb.is_visible_to_organizers, false) = true
    )
    and exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'organizer'
        and p.is_active = true
    )
  )
);

create policy "problems_insert_branch06"
on public.problems
for insert
with check (
  (
    coalesce(is_deleted, false) = false
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.organizer_id = auth.uid()
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = false
    )
  )
  or (
    public.jwt_is_admin()
    and coalesce(is_deleted, false) = false
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = true
    )
  )
);

create policy "problems_update_branch06"
on public.problems
for update
using (
  (
    is_deleted = false
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.organizer_id = auth.uid()
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = false
    )
  )
  or (
    public.jwt_is_admin()
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = true
    )
  )
)
with check (
  (
    exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.organizer_id = auth.uid()
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = false
    )
  )
  or (
    public.jwt_is_admin()
    and exists (
      select 1
      from public.problem_banks pb
      where pb.id = bank_id
        and pb.is_deleted = false
        and coalesce(pb.is_default_bank, false) = true
    )
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'problem-assets',
  'problem-assets',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id)
do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.problem_assets_path_owner_id(p_object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when array_length(string_to_array(coalesce(p_object_name, ''), '/'), 1) = 3
      and split_part(p_object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(p_object_name, '/', 1)::uuid
    else null
  end;
$$;

create or replace function public.problem_assets_path_bank_id(p_object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when array_length(string_to_array(coalesce(p_object_name, ''), '/'), 1) = 3
      and split_part(p_object_name, '/', 2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then split_part(p_object_name, '/', 2)::uuid
    else null
  end;
$$;

create or replace function public.problem_assets_path_is_valid(p_object_name text)
returns boolean
language sql
immutable
as $$
  select
    array_length(string_to_array(coalesce(p_object_name, ''), '/'), 1) = 3
    and public.problem_assets_path_owner_id(p_object_name) is not null
    and public.problem_assets_path_bank_id(p_object_name) is not null
    and split_part(p_object_name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpe?g|png|webp)$';
$$;

drop policy if exists "problem_assets_select_owner_or_admin" on storage.objects;
drop policy if exists "problem_assets_insert_owner" on storage.objects;
drop policy if exists "problem_assets_insert_admin_default_bank" on storage.objects;
drop policy if exists "problem_assets_delete_owner" on storage.objects;
drop policy if exists "problem_assets_delete_admin_default_bank" on storage.objects;

create policy "problem_assets_select_owner_or_admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'problem-assets'
  and (
    public.jwt_is_admin()
    or (
      auth.uid() is not null
      and public.problem_assets_path_is_valid(name)
      and public.problem_assets_path_owner_id(name) = auth.uid()
    )
    or (
      auth.uid() is not null
      and public.problem_assets_path_is_valid(name)
      and exists (
        select 1
        from public.problem_banks pb
        join public.profiles p on p.id = auth.uid()
        where pb.id = public.problem_assets_path_bank_id(name)
          and pb.is_deleted = false
          and coalesce(pb.is_default_bank, false) = true
          and coalesce(pb.is_visible_to_organizers, false) = true
          and p.role = 'organizer'
          and p.is_active = true
      )
    )
  )
);

create policy "problem_assets_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'problem-assets'
  and auth.uid() is not null
  and public.problem_assets_path_is_valid(name)
  and public.problem_assets_path_owner_id(name) = auth.uid()
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = public.problem_assets_path_bank_id(name)
      and pb.organizer_id = auth.uid()
      and pb.is_deleted = false
      and coalesce(pb.is_default_bank, false) = false
  )
);

create policy "problem_assets_insert_admin_default_bank"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'problem-assets'
  and public.jwt_is_admin()
  and public.problem_assets_path_is_valid(name)
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = public.problem_assets_path_bank_id(name)
      and pb.is_deleted = false
      and coalesce(pb.is_default_bank, false) = true
      and pb.organizer_id = public.problem_assets_path_owner_id(name)
  )
);

create policy "problem_assets_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'problem-assets'
  and auth.uid() is not null
  and public.problem_assets_path_is_valid(name)
  and public.problem_assets_path_owner_id(name) = auth.uid()
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = public.problem_assets_path_bank_id(name)
      and pb.organizer_id = auth.uid()
      and pb.is_deleted = false
      and coalesce(pb.is_default_bank, false) = false
  )
);

create policy "problem_assets_delete_admin_default_bank"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'problem-assets'
  and public.jwt_is_admin()
  and public.problem_assets_path_is_valid(name)
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = public.problem_assets_path_bank_id(name)
      and pb.is_deleted = false
      and coalesce(pb.is_default_bank, false) = true
      and pb.organizer_id = public.problem_assets_path_owner_id(name)
  )
);

create table if not exists public.problem_import_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  bank_id uuid not null references public.problem_banks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  idempotency_token text not null,
  status text not null default 'processing',
  total_rows integer not null default 0,
  inserted_rows integer not null default 0,
  failed_rows integer not null default 0,
  row_errors_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

alter table public.problem_import_jobs
  add column if not exists bank_id uuid references public.problem_banks(id) on delete cascade,
  add column if not exists actor_id uuid references public.profiles(id) on delete cascade,
  add column if not exists idempotency_token text,
  add column if not exists status text default 'processing',
  add column if not exists total_rows integer default 0,
  add column if not exists inserted_rows integer default 0,
  add column if not exists failed_rows integer default 0,
  add column if not exists row_errors_json jsonb default '[]'::jsonb,
  add column if not exists created_at timestamptz default timezone('utc', now()),
  add column if not exists updated_at timestamptz default timezone('utc', now()),
  add column if not exists completed_at timestamptz;

create unique index if not exists problem_import_jobs_bank_actor_token_uq
  on public.problem_import_jobs (bank_id, actor_id, idempotency_token);

create index if not exists problem_import_jobs_actor_created_idx
  on public.problem_import_jobs (actor_id, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_import_jobs_status_chk'
      and conrelid = 'public.problem_import_jobs'::regclass
  ) then
    alter table public.problem_import_jobs
      add constraint problem_import_jobs_status_chk
      check (status in ('processing', 'completed', 'failed'));
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_import_jobs_counts_non_negative_chk'
      and conrelid = 'public.problem_import_jobs'::regclass
  ) then
    alter table public.problem_import_jobs
      add constraint problem_import_jobs_counts_non_negative_chk
      check (
        total_rows >= 0
        and inserted_rows >= 0
        and failed_rows >= 0
      );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_import_jobs_idempotency_token_not_blank_chk'
      and conrelid = 'public.problem_import_jobs'::regclass
  ) then
    alter table public.problem_import_jobs
      add constraint problem_import_jobs_idempotency_token_not_blank_chk
      check (nullif(btrim(idempotency_token), '') is not null);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'problem_import_jobs_row_errors_json_array_chk'
      and conrelid = 'public.problem_import_jobs'::regclass
  ) then
    alter table public.problem_import_jobs
      add constraint problem_import_jobs_row_errors_json_array_chk
      check (jsonb_typeof(row_errors_json) = 'array');
  end if;
end;
$$;

alter table public.problem_import_jobs
  alter column status set default 'processing',
  alter column total_rows set default 0,
  alter column inserted_rows set default 0,
  alter column failed_rows set default 0,
  alter column row_errors_json set default '[]'::jsonb,
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now());

update public.problem_import_jobs
set status = coalesce(status, 'processing'),
    total_rows = coalesce(total_rows, 0),
    inserted_rows = coalesce(inserted_rows, 0),
    failed_rows = coalesce(failed_rows, 0),
    row_errors_json = coalesce(row_errors_json, '[]'::jsonb),
    created_at = coalesce(created_at, timezone('utc', now())),
    updated_at = coalesce(updated_at, timezone('utc', now()))
where status is null
   or total_rows is null
   or inserted_rows is null
   or failed_rows is null
   or row_errors_json is null
   or created_at is null
   or updated_at is null;

alter table public.problem_import_jobs enable row level security;

grant select, insert, update on public.problem_import_jobs to authenticated;
grant all privileges on public.problem_import_jobs to service_role;

revoke delete on public.problem_import_jobs from anon;
revoke delete on public.problem_import_jobs from authenticated;

drop policy if exists "problem_import_jobs_select_own" on public.problem_import_jobs;
drop policy if exists "problem_import_jobs_insert_branch06" on public.problem_import_jobs;
drop policy if exists "problem_import_jobs_update_branch06" on public.problem_import_jobs;

create policy "problem_import_jobs_select_own"
on public.problem_import_jobs
for select
using (actor_id = auth.uid());

create policy "problem_import_jobs_insert_branch06"
on public.problem_import_jobs
for insert
with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = bank_id
      and pb.is_deleted = false
      and (
        (
          pb.organizer_id = auth.uid()
          and coalesce(pb.is_default_bank, false) = false
        )
        or (
          public.jwt_is_admin()
          and coalesce(pb.is_default_bank, false) = true
        )
      )
  )
);

create policy "problem_import_jobs_update_branch06"
on public.problem_import_jobs
for update
using (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = bank_id
      and pb.is_deleted = false
      and (
        (
          pb.organizer_id = auth.uid()
          and coalesce(pb.is_default_bank, false) = false
        )
        or (
          public.jwt_is_admin()
          and coalesce(pb.is_default_bank, false) = true
        )
      )
  )
)
with check (
  actor_id = auth.uid()
  and exists (
    select 1
    from public.problem_banks pb
    where pb.id = bank_id
      and pb.is_deleted = false
      and (
        (
          pb.organizer_id = auth.uid()
          and coalesce(pb.is_default_bank, false) = false
        )
        or (
          public.jwt_is_admin()
          and coalesce(pb.is_default_bank, false) = true
        )
      )
  )
);

create or replace function public.refresh_problem_import_jobs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_problem_import_jobs_set_updated_at on public.problem_import_jobs;
create trigger trg_problem_import_jobs_set_updated_at
before update on public.problem_import_jobs
for each row
execute function public.refresh_problem_import_jobs_updated_at();

commit;