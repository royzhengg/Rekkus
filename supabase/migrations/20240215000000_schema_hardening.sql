-- Schema hardening: missing UPDATE policy, orphan column cleanup, and performance indexes.

-- ─── Fix: conversations missing UPDATE policy ─────────────────────────────────
--
-- acceptMessageRequest, declineMessageRequest, and updateGroupInfo all do direct
-- .update() on conversations. Without this policy, those calls are silently denied.

create policy "Participants can update conversations"
  on public.conversations for update
  using (current_user_in_conversation(id))
  with check (current_user_in_conversation(id));

-- ─── Clean up: drop orphan column comments.parent_comment_id ─────────────────
--
-- Migration 20240201 added parent_id (with CASCADE) for comment threads.
-- The original parent_comment_id from the initial schema was never dropped.
-- All app code uses parent_id exclusively. parent_comment_id is dead weight.

alter table public.comments drop column if exists parent_comment_id;

-- ─── Performance: indexes on high-traffic FK columns ─────────────────────────
--
-- These columns are filtered in every core user flow (profile, restaurant page,
-- post detail, feed) but had no dedicated B-tree indexes.

create index if not exists posts_user_id_idx
  on public.posts (user_id);

create index if not exists posts_restaurant_id_idx
  on public.posts (restaurant_id)
  where restaurant_id is not null;

create index if not exists post_photos_post_id_idx
  on public.post_photos (post_id);

create index if not exists likes_post_id_idx
  on public.likes (post_id);

create index if not exists saves_post_id_idx
  on public.saves (post_id);

create index if not exists comments_post_id_idx
  on public.comments (post_id);

-- follows(follower_id) is the leading key of the UNIQUE index — already covered.
-- follows(following_id) has no index and is used in follower-count queries.
create index if not exists follows_following_id_idx
  on public.follows (following_id);
