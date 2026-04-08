begin;

create or replace function public.touch_problem_bank_updated_at_from_problem()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update public.problem_banks
    set updated_at = timezone('utc', now())
    where id = old.bank_id;

    return old;
  end if;

  if tg_op = 'UPDATE' and old.bank_id is distinct from new.bank_id then
    update public.problem_banks
    set updated_at = timezone('utc', now())
    where id = old.bank_id;
  end if;

  update public.problem_banks
  set updated_at = timezone('utc', now())
  where id = new.bank_id;

  return new;
end;
$$;

drop trigger if exists trg_06_problems_20_touch_bank_updated_at on public.problems;
create trigger trg_06_problems_20_touch_bank_updated_at
after insert or update or delete on public.problems
for each row
execute function public.touch_problem_bank_updated_at_from_problem();

commit;
