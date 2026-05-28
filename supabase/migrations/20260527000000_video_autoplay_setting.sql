alter table public.user_settings
  add column if not exists autoplay_videos boolean not null default true;

comment on column public.user_settings.autoplay_videos is
  'Whether muted post videos may autoplay when visible; OS Reduce Motion always overrides playback.';
