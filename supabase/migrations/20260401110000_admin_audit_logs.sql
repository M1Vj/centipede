begin;

create table if not exists public.admin_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action_type text not null,
  target_table text,
  target_id uuid,
  description text,
  metadata jsonb,
  happened_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_audit_logs enable row level security;

grant select, insert on public.admin_audit_logs to authenticated;
grant all privileges on public.admin_audit_logs to service_role;

create policy "admin_audit_logs_select_admin"
  on public.admin_audit_logs
  for select
  using (public.jwt_is_admin());

create policy "admin_audit_logs_insert_admin"
  on public.admin_audit_logs
  for insert
  with check (public.jwt_is_admin());

commit;
