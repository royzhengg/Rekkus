-- Phase A: Extend enums for mention notification pipeline.
-- Must run in its own migration (separate transaction) because PostgreSQL requires
-- ALTER TYPE ... ADD VALUE to commit before the new enum values can be used
-- in index predicates, function bodies, or trigger definitions.
-- See: 20260626000012_mention_notifications.sql for the rest of the pipeline.

do $$ begin
  alter type public.social_event_type add value 'mention';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.social_event_source_type add value 'mention';
exception when duplicate_object then null;
end $$;
