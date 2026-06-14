-- Consolidate the two semantically identical parent FK columns on comments.
-- parent_comment_id was the original column; parent_id was added later with
-- identical semantics. Having both creates ambiguity and a silent data-integrity
-- risk (no constraint prevents them diverging on the same row).
--
-- Migrate any rows where only parent_comment_id is set, then drop it.

update public.comments
  set parent_id = parent_comment_id
  where parent_id is null
    and parent_comment_id is not null;

alter table public.comments
  drop column if exists parent_comment_id;
