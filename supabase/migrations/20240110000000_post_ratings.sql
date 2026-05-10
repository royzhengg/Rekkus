ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS food_rating integer CHECK (food_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS vibe_rating integer CHECK (vibe_rating BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS cost_rating integer CHECK (cost_rating BETWEEN 1 AND 4);
