begin;

do $$
begin
  create type public.team_role as enum ('leader', 'member');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.invitation_status as enum ('pending', 'accepted', 'declined', 'revoked');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.teams (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  team_code text not null,
  created_by uuid not null references public.profiles (id),
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.team_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role public.team_role not null,
  joined_at timestamptz not null default timezone('utc', now()),
  left_at timestamptz,
  is_active boolean not null default true
);

create table if not exists public.team_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  inviter_id uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status public.invitation_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  responded_at timestamptz
);

create table if not exists public.team_action_idempotency (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  target_profile_id uuid references public.profiles (id) on delete set null,
  action_type text not null,
  idempotency_token text not null,
  resource_id uuid,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists teams_name_lower_uq
  on public.teams (lower(name));

create unique index if not exists teams_team_code_uq
  on public.teams (team_code);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_team_code_uppercase_chk'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_team_code_uppercase_chk
      check (team_code = upper(team_code)) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'teams_team_code_format_chk'
      and conrelid = 'public.teams'::regclass
  ) then
    alter table public.teams
      add constraint teams_team_code_format_chk
      check (team_code ~ '^[A-Z0-9]{10}$') not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_memberships_active_left_at_chk'
      and conrelid = 'public.team_memberships'::regclass
  ) then
    alter table public.team_memberships
      add constraint team_memberships_active_left_at_chk
      check (is_active = false or left_at is null) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_invitations_responded_at_chk'
      and conrelid = 'public.team_invitations'::regclass
  ) then
    alter table public.team_invitations
      add constraint team_invitations_responded_at_chk
      check (status = 'pending' or responded_at is not null) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_action_idempotency_token_chk'
      and conrelid = 'public.team_action_idempotency'::regclass
  ) then
    alter table public.team_action_idempotency
      add constraint team_action_idempotency_token_chk
      check (nullif(btrim(idempotency_token), '') is not null) not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'team_action_idempotency_action_chk'
      and conrelid = 'public.team_action_idempotency'::regclass
  ) then
    alter table public.team_action_idempotency
      add constraint team_action_idempotency_action_chk
      check (nullif(btrim(action_type), '') is not null) not valid;
  end if;
end
$$;

create unique index if not exists team_memberships_active_uq
  on public.team_memberships (team_id, profile_id)
  where is_active = true;

create unique index if not exists team_memberships_active_leader_uq
  on public.team_memberships (team_id)
  where is_active = true and role = 'leader';

create index if not exists team_memberships_active_idx
  on public.team_memberships (team_id)
  where is_active = true;

create unique index if not exists team_invitations_pending_uq
  on public.team_invitations (team_id, invitee_id)
  where status = 'pending';

create unique index if not exists team_action_idempotency_uq
  on public.team_action_idempotency (team_id, actor_id, action_type, idempotency_token);

create or replace function public.team_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.team_bootstrap_leader_membership()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is null then
    return new;
  end if;

  insert into public.team_memberships (
    id,
    team_id,
    profile_id,
    role,
    joined_at,
    is_active
  )
  select
    extensions.gen_random_uuid(),
    new.id,
    new.created_by,
    'leader',
    timezone('utc', now()),
    true
  where not exists (
    select 1
    from public.team_memberships
    where team_id = new.id
      and profile_id = new.created_by
      and is_active = true
  );

  return new;
end;
$$;

create or replace function public.transfer_team_leadership(p_team_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_leader_id uuid;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Only trusted team management flows may execute transfer_team_leadership.';
  end if;

  if p_team_id is null then
    raise exception 'team_id is required.';
  end if;

  if exists (
    select 1
    from public.team_memberships
    where team_id = p_team_id
      and is_active = true
      and role = 'leader'
  ) then
    return null;
  end if;

  select id
  into v_next_leader_id
  from public.team_memberships
  where team_id = p_team_id
    and is_active = true
  order by joined_at asc, id asc
  limit 1;

  if v_next_leader_id is null then
    return null;
  end if;

  update public.team_memberships
  set role = 'leader'
  where id = v_next_leader_id;

  return v_next_leader_id;
end;
$$;

create or replace function public.team_membership_handle_leader_departure()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.role = 'leader'
      and old.is_active = true
      and (new.is_active = false or new.left_at is not null) then
      perform public.transfer_team_leadership(new.team_id);
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.role = 'leader' and old.is_active = true then
      perform public.transfer_team_leadership(old.team_id);
    end if;
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.is_active_team_member(
  p_team_id uuid,
  p_profile_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_memberships
    where team_id = p_team_id
      and profile_id = p_profile_id
      and is_active = true
  );
$$;

drop trigger if exists trg_09_teams_set_updated_at on public.teams;
create trigger trg_09_teams_set_updated_at
before update on public.teams
for each row
execute function public.team_set_updated_at();

drop trigger if exists trg_09_teams_bootstrap_leader on public.teams;
create trigger trg_09_teams_bootstrap_leader
after insert on public.teams
for each row
execute function public.team_bootstrap_leader_membership();

drop trigger if exists trg_09_team_memberships_handle_leader_departure on public.team_memberships;
create trigger trg_09_team_memberships_handle_leader_departure
after update or delete on public.team_memberships
for each row
execute function public.team_membership_handle_leader_departure();

alter table public.teams enable row level security;
alter table public.team_memberships enable row level security;
alter table public.team_invitations enable row level security;
alter table public.team_action_idempotency enable row level security;

drop policy if exists "teams_select_members" on public.teams;
create policy "teams_select_members"
on public.teams
for select
using (
  public.jwt_is_admin()
  or public.is_active_team_member(id, auth.uid())
);

drop policy if exists "teams_service_write" on public.teams;
create policy "teams_service_write"
on public.teams
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "team_memberships_select_members" on public.team_memberships;
create policy "team_memberships_select_members"
on public.team_memberships
for select
using (
  public.jwt_is_admin()
  or public.is_active_team_member(team_id, auth.uid())
);

drop policy if exists "team_memberships_service_write" on public.team_memberships;
create policy "team_memberships_service_write"
on public.team_memberships
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "team_invitations_select_actor" on public.team_invitations;
create policy "team_invitations_select_actor"
on public.team_invitations
for select
using (
  public.jwt_is_admin()
  or inviter_id = auth.uid()
  or (invitee_id = auth.uid() and status = 'pending')
);

drop policy if exists "team_invitations_service_write" on public.team_invitations;
create policy "team_invitations_service_write"
on public.team_invitations
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop policy if exists "team_action_idempotency_service_only" on public.team_action_idempotency;
create policy "team_action_idempotency_service_only"
on public.team_action_idempotency
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke all on function public.transfer_team_leadership(uuid) from public;

grant all privileges on public.teams to service_role;
grant all privileges on public.team_memberships to service_role;
grant all privileges on public.team_invitations to service_role;
grant all privileges on public.team_action_idempotency to service_role;

grant execute on function public.transfer_team_leadership(uuid) to service_role;

commit;
