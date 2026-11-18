-- «Сходим?» — структура базы данных для Supabase
-- Запускать ОДИН раз: Supabase → SQL Editor → New query → вставить всё → Run.

-- =========================================================
-- 1. Таблицы
-- =========================================================

-- Общий список (одно «пространство» на вас двоих)
create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Наш список',
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Кто состоит в списке
create table public.space_members (
  space_id     uuid not null references public.spaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text,
  joined_at    timestamptz not null default now(),
  primary key (space_id, user_id)
);

-- Группы: города (Минск, Брест…) и поездки (живут в «Путешествиях»)
create table public.groups (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  name        text not null,
  kind        text not null default 'city' check (kind in ('city', 'trip')),
  cover_color text,                -- пастельный цвет обложки, если нет фото
  cover_path  text,                -- путь к фото обложки в хранилище
  trip_status text check (trip_status in ('dream', 'planned', 'done')),
  trip_start  date,
  trip_end    date,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Места
create table public.places (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  group_id    uuid not null references public.groups(id) on delete cascade,
  name        text not null,
  instagram   text,
  address     text,
  lat         double precision,    -- координаты для карты
  lng         double precision,
  note        text,
  tags        text[] not null default '{}',
  cover_path  text,
  want_again  boolean not null default false,   -- «хотим снова»
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Визиты (у одного места может быть много)
create table public.visits (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  place_id    uuid not null references public.places(id) on delete cascade,
  visited_on  date not null default current_date,  -- дату можно менять задним числом
  note        text,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Фото визитов
create table public.visit_photos (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  visit_id    uuid not null references public.visits(id) on delete cascade,
  path        text not null,       -- путь к файлу в хранилище: <space_id>/...
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index on public.groups (space_id);
create index on public.places (space_id);
create index on public.places (group_id);
create index on public.visits (place_id);
create index on public.visits (space_id, visited_on desc);
create index on public.visit_photos (visit_id);

-- Автообновление updated_at у мест
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger places_touch_updated_at
before update on public.places
for each row execute function public.touch_updated_at();

-- =========================================================
-- 2. Доступ: всё видят и меняют только участники списка
-- =========================================================

create or replace function public.is_member(p_space uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space and user_id = auth.uid()
  );
$$;

-- Создать список (первый человек)
create or replace function public.create_space(p_name text default 'Наш список', p_display_name text default null)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare s public.spaces;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.spaces (name, created_by)
  values (coalesce(p_name, 'Наш список'), auth.uid())
  returning * into s;
  insert into public.space_members (space_id, user_id, display_name)
  values (s.id, auth.uid(), p_display_name);
  return s;
end $$;

-- Присоединиться по коду приглашения (второй человек)
create or replace function public.join_space(p_code text, p_display_name text default null)
returns public.spaces language plpgsql security definer set search_path = public as $$
declare s public.spaces;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into s from public.spaces
  where invite_code = upper(replace(trim(p_code), '-', ''));
  if not found then raise exception 'invite code not found'; end if;
  insert into public.space_members (space_id, user_id, display_name)
  values (s.id, auth.uid(), p_display_name)
  on conflict do nothing;
  return s;
end $$;

revoke execute on function public.create_space(text, text) from anon;
revoke execute on function public.join_space(text, text) from anon;

alter table public.spaces        enable row level security;
alter table public.space_members enable row level security;
alter table public.groups        enable row level security;
alter table public.places        enable row level security;
alter table public.visits        enable row level security;
alter table public.visit_photos  enable row level security;

create policy "spaces: members read"   on public.spaces for select using (public.is_member(id));
create policy "spaces: members update" on public.spaces for update using (public.is_member(id));

create policy "members: read"        on public.space_members for select using (public.is_member(space_id));
create policy "members: update self" on public.space_members for update using (user_id = auth.uid());
create policy "members: leave"       on public.space_members for delete using (user_id = auth.uid());

create policy "groups: members"       on public.groups       for all using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy "places: members"       on public.places       for all using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy "visits: members"       on public.visits       for all using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy "visit_photos: members" on public.visit_photos for all using (public.is_member(space_id)) with check (public.is_member(space_id));

-- =========================================================
-- 3. Хранилище фото (закрытое, только для участников)
-- =========================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Файлы лежат по пути <space_id>/<...>; доступ — только участникам этого списка
create or replace function public.is_member_path(p_name text)
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  return public.is_member(((storage.foldername(p_name))[1])::uuid);
exception when others then
  return false;
end $$;

create policy "photos: members read"   on storage.objects for select to authenticated using (bucket_id = 'photos' and public.is_member_path(name));
create policy "photos: members upload" on storage.objects for insert to authenticated with check (bucket_id = 'photos' and public.is_member_path(name));
create policy "photos: members update" on storage.objects for update to authenticated using (bucket_id = 'photos' and public.is_member_path(name));
create policy "photos: members delete" on storage.objects for delete to authenticated using (bucket_id = 'photos' and public.is_member_path(name));

-- =========================================================
-- 4. Живое обновление: изменения сразу видны на втором телефоне
-- =========================================================

alter publication supabase_realtime add table public.groups, public.places, public.visits, public.visit_photos;
