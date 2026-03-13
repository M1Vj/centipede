begin;

grant insert on public.profiles to authenticated;

drop policy if exists "profiles_insert_self_or_admin" on public.profiles;

create policy "profiles_insert_self_or_admin"
on public.profiles
for insert
with check (auth.uid() = id or public.jwt_is_admin());

commit;
