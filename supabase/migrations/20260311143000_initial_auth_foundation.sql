begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

do $$
begin
  create type public.profile_role as enum ('mathlete', 'organizer', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.organizer_application_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end
$$;

create or replace function public.jwt_is_admin()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role'
    or coalesce(auth.jwt() -> 'app_metadata' ->> 'role' = 'admin', false)
    or coalesce(auth.jwt() -> 'user_metadata' ->> 'role' = 'admin', false);
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique check (email = lower(email)),
  full_name text not null default '',
  role public.profile_role not null default 'mathlete',
  school text,
  grade_level text,
  organization text,
  approved_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.organizer_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  profile_id uuid not null unique references public.profiles (id) on delete cascade,
  statement text not null,
  logo_url text,
  status public.organizer_application_status not null default 'pending',
  rejection_reason text,
  submitted_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists organizer_applications_status_idx on public.organizer_applications (status);

create or replace function public.insert_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    raise exception 'New auth user is missing an email address.';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'mathlete',
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

create or replace function public.handle_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.email := lower(new.email);

  if auth.role() <> 'service_role' and not public.jwt_is_admin() then
    if new.role <> old.role then
      raise exception 'Only admins may change profile roles.';
    end if;

    if new.approved_at is distinct from old.approved_at then
      raise exception 'Only admins may change organizer approval status.';
    end if;

    if new.is_active is distinct from old.is_active then
      raise exception 'Only admins may change activation status.';
    end if;
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.insert_profile_for_new_user();

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update
before update on public.profiles
for each row execute procedure public.handle_profile_changes();

alter table public.profiles enable row level security;
alter table public.organizer_applications enable row level security;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organizer_applications to authenticated;
grant all privileges on public.profiles to service_role;
grant all privileges on public.organizer_applications to service_role;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.jwt_is_admin());

create policy "profiles_update_self_or_admin"
on public.profiles
for update
using (auth.uid() = id or public.jwt_is_admin())
with check (auth.uid() = id or public.jwt_is_admin());

create policy "organizer_applications_select_self_or_admin"
on public.organizer_applications
for select
using (profile_id = auth.uid() or public.jwt_is_admin());

create policy "organizer_applications_insert_self"
on public.organizer_applications
for insert
with check (
  profile_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'organizer'
      and profiles.approved_at is null
      and profiles.is_active = true
  )
);

create policy "organizer_applications_update_admin"
on public.organizer_applications
for update
using (public.jwt_is_admin())
with check (public.jwt_is_admin());

create policy "organizer_applications_delete_admin"
on public.organizer_applications
for delete
using (public.jwt_is_admin());

commit;
