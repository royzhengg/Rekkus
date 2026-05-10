alter table public.restaurants drop constraint if exists restaurants_google_place_id_key;
alter table public.restaurants add constraint restaurants_google_place_id_key unique (google_place_id);

create policy "Authenticated users can update restaurants"
  on public.restaurants for update
  using (auth.role() = 'authenticated');

create table public.saved_locations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users on delete cascade not null,
  restaurant_id uuid references public.restaurants on delete cascade not null,
  created_at timestamptz not null default now(),
  unique (user_id, restaurant_id)
);
alter table public.saved_locations enable row level security;
create policy "Users manage own saved locations"
  on public.saved_locations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
