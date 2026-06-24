# Follower Count Mismatch

1. Treat `follows` as truth.
2. Recompute `users.follower_count` from `follows`.
3. Check `trg_follows_update_follower_count`.
4. Do not derive follower counts from `social_events`.

