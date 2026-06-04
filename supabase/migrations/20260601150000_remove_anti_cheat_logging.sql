begin;

drop function if exists public.log_tab_switch_offense(uuid, jsonb);
drop function if exists public.log_tab_switch_offense(uuid, jsonb, uuid);

do $$
begin
  if to_regclass('public.tab_switch_logs') is not null then
    update public.competition_attempts
    set offense_count = 0
    where id in (
      select distinct attempt_id
      from public.tab_switch_logs
    );
  end if;

  if to_regclass('public.leaderboard_entries') is not null then
    update public.leaderboard_entries
    set offense_count = 0
    where offense_count <> 0;
  end if;
end $$;

drop table if exists public.tab_switch_logs;

alter table public.competitions
  drop constraint if exists competitions_offense_penalties_json_object_chk;

update public.competitions
set
  log_tab_switch = false,
  offense_penalties = '[]'::jsonb,
  offense_penalties_json = null
where
  log_tab_switch is true
  or offense_penalties is distinct from '[]'::jsonb
  or offense_penalties_json is not null;

comment on column public.competitions.log_tab_switch is
  'Deprecated. Tab-switch warnings are client-local only and are not logged.';
comment on column public.competitions.offense_penalties is
  'Deprecated. Anti-cheat offense penalties have been removed.';
comment on column public.competitions.offense_penalties_json is
  'Deprecated. Anti-cheat offense penalties have been removed.';
comment on column public.competition_attempts.offense_count is
  'Deprecated. Tab-switch events are warning-only and no longer counted.';

do $$
begin
  if to_regclass('public.leaderboard_entries') is not null then
    comment on column public.leaderboard_entries.offense_count is
      'Deprecated. Tab-switch events are warning-only and no longer counted.';
  end if;
end $$;

commit;
