-- «Сходим?» — наши фильмы (вкладка «Фильмы» в альбоме).
-- Запустить один раз: Supabase → SQL Editor → New query → вставить всё → Run.
-- Можно запускать повторно — ничего не сломается.

create table if not exists public.films (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces(id) on delete cascade,
  title       text not null,
  watched_on  date not null default current_date,
  poster_path text,                                                     -- афиша в хранилище photos: <space_id>/...
  place_id    uuid references public.places(id) on delete set null,     -- кинотеатр из наших мест
  cinema      text,                                                     -- «другой кинотеатр» словами
  at_home     boolean not null default false,                           -- смотрели дома
  ratings     jsonb not null default '{}',                              -- оценки: id участницы → 0..5
  note        text,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now()
);
create index if not exists films_space_idx on public.films (space_id, watched_on desc);

alter table public.films enable row level security;
drop policy if exists "films: members" on public.films;
create policy "films: members" on public.films for all
  using (public.is_member(space_id)) with check (public.is_member(space_id));

-- своя оценка: каждая меняет только свою, не затирая оценку подруги
create or replace function public.film_rate(p_film uuid, p_stars int)
returns public.films language plpgsql security definer set search_path = public as $$
declare f public.films;
begin
  select * into f from public.films where id = p_film;
  if not found or not public.is_member(f.space_id) then raise exception 'not a member'; end if;
  if p_stars is null or p_stars <= 0 then
    update public.films set ratings = ratings - auth.uid()::text where id = p_film returning * into f;
  else
    update public.films set ratings = jsonb_set(ratings, array[auth.uid()::text], to_jsonb(least(p_stars, 5)), true)
     where id = p_film returning * into f;
  end if;
  return f;
end $$;
grant execute on function public.film_rate(uuid, int) to authenticated;

-- живое обновление у обеих
do $$ begin
  alter publication supabase_realtime add table public.films;
exception when duplicate_object then null; end $$;
