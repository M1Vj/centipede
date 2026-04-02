begin;

-- Enums for specialized data types
do $$ begin
  create type public.problem_type as enum ('mcq', 'tf', 'numeric', 'identification');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.difficulty as enum ('easy', 'average', 'difficult');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.competition_type as enum ('scheduled', 'open');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.competition_format as enum ('individual', 'team');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.scoring_mode as enum ('automatic', 'custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.penalty_mode as enum ('none', 'deduction');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tie_breaker as enum ('earliest_submission', 'latest_submission', 'average_time');
exception when duplicate_object then null; end $$;

-- 1.4 Problem Banks (Repositories for Organizer content)
create table if not exists public.problem_banks (
  id uuid primary key default extensions.gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- Problems (Atom units in the bank)
create table if not exists public.problems (
  id uuid primary key default extensions.gen_random_uuid(),
  bank_id uuid not null references public.problem_banks(id) on delete cascade,
  type public.problem_type not null,
  content text not null,
  options jsonb,
  answers jsonb not null,
  difficulty public.difficulty not null default 'average',
  tags text[],
  image_url text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- 1.5 Competitions (Events)
create table if not exists public.competitions (
  id uuid primary key default extensions.gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  instructions text,
  type public.competition_type not null default 'scheduled',
  format public.competition_format not null default 'individual',
  registration_start timestamptz,
  registration_end timestamptz,
  start_time timestamptz,
  duration_minutes integer not null default 60,
  attempts_allowed integer not null default 1,
  max_participants integer,
  participants_per_team integer,
  max_teams integer,
  scoring_mode public.scoring_mode not null default 'automatic',
  custom_points jsonb,
  penalty_mode public.penalty_mode not null default 'none',
  deduction_value integer default 0,
  tie_breaker public.tie_breaker not null default 'earliest_submission',
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  log_tab_switch boolean not null default false,
  offense_penalties jsonb,
  published boolean not null default false,
  is_paused boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

-- Join table for Competitions and Problems
create table if not exists public.competition_problems (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  problem_id uuid not null references public.problems(id) on delete cascade,
  points integer,
  order_index integer
);

-- 1.7 Competition Events (Audit Trail for Administrative Actions)
create table if not exists public.competition_events (
  id uuid primary key default extensions.gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  event_type text not null, -- 'published', 'paused', 'resumed', 'extended'
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  happened_at timestamptz not null default timezone('utc', now())
);

-- Enable RLS
alter table public.problem_banks enable row level security;
alter table public.problems enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_problems enable row level security;
alter table public.competition_events enable row level security;

-- Policies for Problem Banks
create policy "problem_banks_select" on public.problem_banks for select using (organizer_id = auth.uid() or public.jwt_is_admin());
create policy "problem_banks_insert" on public.problem_banks for insert with check (organizer_id = auth.uid() or public.jwt_is_admin());
create policy "problem_banks_update" on public.problem_banks for update using (organizer_id = auth.uid() or public.jwt_is_admin());

-- Policies for Problems
create policy "problems_select" on public.problems for select using (exists (select 1 from public.problem_banks where id = bank_id and (organizer_id = auth.uid() or public.jwt_is_admin())));
create policy "problems_insert" on public.problems for insert with check (exists (select 1 from public.problem_banks where id = bank_id and (organizer_id = auth.uid() or public.jwt_is_admin())));
create policy "problems_update" on public.problems for update using (exists (select 1 from public.problem_banks where id = bank_id and (organizer_id = auth.uid() or public.jwt_is_admin())));

-- Policies for Competitions
create policy "competitions_select" on public.competitions for select using (published = true or organizer_id = auth.uid() or public.jwt_is_admin());
create policy "competitions_insert" on public.competitions for insert with check (organizer_id = auth.uid() or public.jwt_is_admin());
create policy "competitions_update" on public.competitions for update using (organizer_id = auth.uid() or public.jwt_is_admin());

-- Policies for Competition Events
create policy "competition_events_select" on public.competition_events for select using (public.jwt_is_admin() or exists (select 1 from public.competitions where id = competition_id and organizer_id = auth.uid()));
create policy "competition_events_insert" on public.competition_events for insert with check (public.jwt_is_admin() or exists (select 1 from public.competitions where id = competition_id and organizer_id = auth.uid()));

commit;
