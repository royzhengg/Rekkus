-- Remove saved-place intent status.
--
-- Saved restaurants are now a simple bookmark set. User-created collections own
-- organization, and posts/reviews are the visited evidence for social proof.

drop trigger if exists trg_posts_advance_save_status on public.posts;
drop function if exists public.handle_post_restaurant_save();

alter table if exists public.saved_locations
  drop column if exists save_status;
