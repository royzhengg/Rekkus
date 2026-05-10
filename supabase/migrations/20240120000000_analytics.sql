-- Cache Google ratings on restaurants (populated lazily when a location detail page is first viewed)
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS google_review_count INTEGER;

-- Unified raw event log for analytics, trending, and ranking signals
-- event_type: 'search_query' | 'place_click' | 'place_view' | 'post_view' | 'post_like' | 'post_save'
-- entity_type: 'restaurant' | 'post' | 'user'
-- metadata: flexible JSONB e.g. { "query": "ramen", "position": 2 } for search events
CREATE TABLE IF NOT EXISTS analytics_events (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    UUID,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events" ON analytics_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Aggregate reads public" ON analytics_events
  FOR SELECT USING (true);

-- Fast lookups for trending queries and search ranking
CREATE INDEX IF NOT EXISTS idx_analytics_entity
  ON analytics_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_type_created
  ON analytics_events (event_type, created_at DESC);
