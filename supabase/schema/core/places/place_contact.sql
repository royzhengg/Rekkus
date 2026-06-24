-- Domain: Core
-- Owner: Discovery
-- Classification: Metadata
-- Lifecycle: Core
-- Source of Truth: Yes

-- place_contact: owned by contact enrichment features
create table if not exists public.place_contact (
  place_id                 uuid        primary key references public.places(id) on delete cascade,
  phone                    text,
  website                  text,
  instagram_url            text,
  facebook_url             text,
  tiktok_url               text,
  last_verified_at         timestamptz,
  last_owner_update_at     timestamptz,
  last_community_update_at timestamptz,
  updated_at               timestamptz not null default now()
);

-- Indexes
create index if not exists idx_place_contact_website on public.place_contact (lower(website)) where website is not null;
