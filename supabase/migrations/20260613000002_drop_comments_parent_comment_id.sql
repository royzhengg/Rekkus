-- Consolidate the two semantically identical parent FK columns on comments.
-- parent_comment_id was the original column; parent_id was added later with
-- identical semantics. Having both creates ambiguity and a silent data-integrity
-- risk (no constraint prevents them diverging on the same row).
--
-- Note: 20240215000000_schema_hardening.sql already dropped this column via
-- DROP COLUMN IF EXISTS. The UPDATE below is guarded in case the column is absent.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'comments'
      and column_name  = 'parent_comment_id'
  ) then
    update public.comments
      set parent_id = parent_comment_id
      where parent_id is null
        and parent_comment_id is not null;
  end if;
end $$;

alter table public.comments
  drop column if exists parent_comment_id;
