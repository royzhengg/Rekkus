-- B-551: DB-backed search synonym vocabulary.
-- Public-read reference data; operator/admin write tooling is outside client scope.

create table if not exists public.search_synonyms (
  id bigserial primary key,
  term text not null,
  canonical text not null,
  type text not null check (type in ('cuisine', 'occasion', 'dietary')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint search_synonyms_non_empty check (
    btrim(term) <> '' and btrim(canonical) <> ''
  )
);

create unique index if not exists search_synonyms_type_term_canonical_uidx
  on public.search_synonyms (type, lower(term), lower(canonical));

create index if not exists search_synonyms_enabled_type_term_idx
  on public.search_synonyms (enabled, type, lower(term));

alter table public.search_synonyms enable row level security;

do $$
begin
  create policy "Anyone can read search synonyms"
    on public.search_synonyms for select
    using (true);
exception
  when duplicate_object then null;
end $$;

insert into public.search_synonyms (term, canonical, type) values
  ('ramen', 'japanese', 'cuisine'),
  ('sushi', 'japanese', 'cuisine'),
  ('tempura', 'japanese', 'cuisine'),
  ('yakitori', 'japanese', 'cuisine'),
  ('udon', 'japanese', 'cuisine'),
  ('sashimi', 'japanese', 'cuisine'),
  ('izakaya', 'japanese', 'cuisine'),
  ('tonkatsu', 'japanese', 'cuisine'),
  ('dumpling', 'chinese', 'cuisine'),
  ('dumpling', 'asian', 'cuisine'),
  ('dumplings', 'chinese', 'cuisine'),
  ('dumplings', 'asian', 'cuisine'),
  ('dim sum', 'chinese', 'cuisine'),
  ('noodle', 'chinese', 'cuisine'),
  ('noodle', 'asian', 'cuisine'),
  ('noodles', 'chinese', 'cuisine'),
  ('noodles', 'asian', 'cuisine'),
  ('wonton', 'chinese', 'cuisine'),
  ('pizza', 'italian', 'cuisine'),
  ('pasta', 'italian', 'cuisine'),
  ('risotto', 'italian', 'cuisine'),
  ('gelato', 'italian', 'cuisine'),
  ('taco', 'mexican', 'cuisine'),
  ('tacos', 'mexican', 'cuisine'),
  ('burrito', 'mexican', 'cuisine'),
  ('quesadilla', 'mexican', 'cuisine'),
  ('nachos', 'mexican', 'cuisine'),
  ('curry', 'indian', 'cuisine'),
  ('biryani', 'indian', 'cuisine'),
  ('naan', 'indian', 'cuisine'),
  ('tikka', 'indian', 'cuisine'),
  ('masala', 'indian', 'cuisine'),
  ('pho', 'vietnamese', 'cuisine'),
  ('banh', 'vietnamese', 'cuisine'),
  ('bahn', 'vietnamese', 'cuisine'),
  ('burger', 'american', 'cuisine'),
  ('burgers', 'american', 'cuisine'),
  ('bbq', 'american', 'cuisine'),
  ('wings', 'american', 'cuisine'),
  ('falafel', 'middle eastern', 'cuisine'),
  ('falafel', 'lebanese', 'cuisine'),
  ('hummus', 'middle eastern', 'cuisine'),
  ('hummus', 'lebanese', 'cuisine'),
  ('pad', 'thai', 'cuisine'),
  ('satay', 'thai', 'cuisine'),
  ('satay', 'indonesian', 'cuisine'),
  ('tom', 'thai', 'cuisine'),
  ('croissant', 'french', 'cuisine'),
  ('croissant', 'bakery', 'cuisine'),
  ('crepe', 'french', 'cuisine'),
  ('baguette', 'french', 'cuisine'),
  ('tapas', 'spanish', 'cuisine'),
  ('paella', 'spanish', 'cuisine'),
  ('schnitzel', 'german', 'cuisine'),
  ('schnitzel', 'european', 'cuisine'),
  ('bratwurst', 'german', 'cuisine'),
  ('kebab', 'turkish', 'cuisine'),
  ('kebab', 'middle eastern', 'cuisine'),
  ('shawarma', 'turkish', 'cuisine'),
  ('shawarma', 'middle eastern', 'cuisine'),
  ('gyros', 'greek', 'cuisine'),
  ('souvlaki', 'greek', 'cuisine'),
  ('brunch', 'cafe', 'cuisine'),
  ('brunch', 'australian', 'cuisine'),
  ('smashed', 'cafe', 'cuisine'),
  ('smashed', 'australian', 'cuisine'),
  ('nasi', 'indonesian', 'cuisine'),
  ('nasi', 'asian', 'cuisine'),
  ('rendang', 'indonesian', 'cuisine'),
  ('gado', 'indonesian', 'cuisine'),
  ('mie', 'indonesian', 'cuisine'),
  ('mie', 'asian', 'cuisine'),
  ('bakso', 'indonesian', 'cuisine'),
  ('bibimbap', 'korean', 'cuisine'),
  ('kimchi', 'korean', 'cuisine'),
  ('bulgogi', 'korean', 'cuisine'),
  ('japchae', 'korean', 'cuisine'),
  ('kbbq', 'korean', 'cuisine'),
  ('mezze', 'mediterranean', 'cuisine'),
  ('mezze', 'middle eastern', 'cuisine'),
  ('tzatziki', 'greek', 'cuisine'),
  ('tzatziki', 'mediterranean', 'cuisine'),
  ('baklava', 'turkish', 'cuisine'),
  ('baklava', 'greek', 'cuisine'),
  ('date night', 'date_night', 'occasion'),
  ('date', 'date_night', 'occasion'),
  ('romantic', 'date_night', 'occasion'),
  ('casual', 'casual', 'occasion'),
  ('catch up', 'casual', 'occasion'),
  ('coffee', 'casual', 'occasion'),
  ('quick bite', 'quick_bite', 'occasion'),
  ('quick', 'quick_bite', 'occasion'),
  ('takeaway', 'quick_bite', 'occasion'),
  ('group', 'group', 'occasion'),
  ('family', 'group', 'occasion'),
  ('friends', 'group', 'occasion'),
  ('special', 'special', 'occasion'),
  ('celebration', 'special', 'occasion'),
  ('birthday', 'special', 'occasion'),
  ('anniversary', 'special', 'occasion'),
  ('fine dining', 'special', 'occasion'),
  ('fancy', 'special', 'occasion'),
  ('solo', 'solo', 'occasion'),
  ('alone', 'solo', 'occasion'),
  ('vegan', 'vegan', 'dietary'),
  ('vegetarian', 'vegetarian', 'dietary'),
  ('halal', 'halal', 'dietary'),
  ('kosher', 'kosher', 'dietary'),
  ('gluten free', 'gluten_free', 'dietary'),
  ('gluten-free', 'gluten_free', 'dietary'),
  ('dairy free', 'dairy_free', 'dietary')
on conflict do nothing;
