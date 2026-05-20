ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'system'
    CHECK (theme_mode IN ('light', 'dark', 'system'));
