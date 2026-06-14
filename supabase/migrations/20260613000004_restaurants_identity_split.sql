-- Drop the 8 write-only Google detail columns from restaurants.
-- These fields are already stored in restaurant_provider_cache.normalized_payload
-- via record_restaurant_provider_snapshot. Keeping them on restaurants was
-- redundant and created silent drift risk between the two copies.
--
-- NOT dropped (promoted display/search signals still used in read paths):
--   google_rating, google_review_count, google_photo_refs,
--   open_now, open_now_checked_at
--   google_place_id (identity key)

alter table public.restaurants
  drop column if exists google_details_fetched_at,
  drop column if exists google_details_fields,
  drop column if exists google_business_status,
  drop column if exists google_phone,
  drop column if exists google_website,
  drop column if exists google_price_level,
  drop column if exists google_types,
  drop column if exists google_opening_hours;
