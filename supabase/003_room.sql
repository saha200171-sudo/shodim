-- «Сходим?» — комната, стаканчики, тип места и «Наша плёнка».
-- Запустить один раз: Supabase → SQL Editor → New query → вставить всё → Run.
-- Можно запускать повторно — ничего не сломается.

-- 1) Тип места для достижений: кафе / кино / выставка / природа / экстрим (можно несколько)
alter table public.places add column if not exists kinds text[] not null default '{}';

-- 2) Комната: купленные вещи и что где стоит (одна строка на общий список)
create table if not exists public.room (
  space_id   uuid primary key references public.spaces(id) on delete cascade,
  owned      text[] not null default '{}',   -- купленные в магазине вещи (трофеи считаются сами по достижениям)
  placed     jsonb  not null default '{}',   -- место в комнате → вещь (null = место пустое)
  updated_at timestamptz not null default now()
);
alter table public.room enable row level security;
drop policy if exists "room: members" on public.room;
create policy "room: members" on public.room for all
  using (public.is_member(space_id)) with check (public.is_member(space_id));

-- покупка: добавляем вещь, не затирая то, что параллельно купила подруга
create or replace function public.room_buy(p_space uuid, p_item text)
returns public.room language plpgsql security definer set search_path = public as $$
declare r public.room;
begin
  if not public.is_member(p_space) then raise exception 'not a member'; end if;
  insert into public.room (space_id) values (p_space) on conflict (space_id) do nothing;
  update public.room
     set owned = case when p_item = any(owned) then owned else array_append(owned, p_item) end,
         updated_at = now()
   where space_id = p_space
  returning * into r;
  return r;
end $$;

-- поставить вещь на место (p_item = null — убрать с места)
create or replace function public.room_place(p_space uuid, p_slot text, p_item text)
returns public.room language plpgsql security definer set search_path = public as $$
declare r public.room;
begin
  if not public.is_member(p_space) then raise exception 'not a member'; end if;
  insert into public.room (space_id) values (p_space) on conflict (space_id) do nothing;
  update public.room
     set placed = jsonb_set(placed, array[p_slot], coalesce(to_jsonb(p_item), 'null'::jsonb), true),
         updated_at = now()
   where space_id = p_space
  returning * into r;
  return r;
end $$;

-- 3) «Наша плёнка»: сколько места занимают фото списка в облаке
create or replace function public.storage_usage(p_space uuid)
returns table (bytes bigint, files integer)
language plpgsql security definer set search_path = public, storage as $$
begin
  if not public.is_member(p_space) then raise exception 'not a member'; end if;
  return query
    select coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint, count(*)::integer
      from storage.objects o
     where o.bucket_id = 'photos' and o.name like p_space::text || '/%';
end $$;

grant execute on function public.room_buy(uuid, text), public.room_place(uuid, text, text), public.storage_usage(uuid) to authenticated;

-- 4) живое обновление комнаты у обеих
do $$ begin
  alter publication supabase_realtime add table public.room;
exception when duplicate_object then null; end $$;
