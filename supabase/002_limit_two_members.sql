-- «Сходим?» — в общий список могут войти максимум два человека.
-- Запустить один раз: Supabase → SQL Editor → New query → вставить → Run.
-- Уже вошедшие участники могут спокойно входить снова (например, с нового телефона).

create or replace function public.join_space(p_code text, p_display_name text default null)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare s public.spaces;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into s from public.spaces
  where invite_code = upper(replace(trim(p_code), '-', ''));
  if not found then raise exception 'invite code not found'; end if;

  -- уже участник — просто возвращаем список
  if exists (select 1 from public.space_members where space_id = s.id and user_id = auth.uid()) then
    return s;
  end if;

  -- блокируем список на время проверки, чтобы двое не вошли одновременно третьим
  perform 1 from public.spaces where id = s.id for update;
  if (select count(*) from public.space_members where space_id = s.id) >= 2 then
    raise exception 'space is full';
  end if;

  insert into public.space_members (space_id, user_id, display_name)
  values (s.id, auth.uid(), p_display_name);
  return s;
end $$;

revoke execute on function public.join_space(text, text) from anon;
