# Users Entities

## Tables

- `users`: canonical user record. Source of truth for identity and display name.
- `user_settings`: preferences and privacy mode per user. Always present — created atomically with the user row.
- `follows`: active approved follow relationships. Directional: `follower_id` → `following_id`.
- `follow_requests`: full lifecycle of follow requests (pending, approved, declined, cancelled). Separate from `follows`.
- `user_blocks`: block relationships. Directional for initiation; symmetric for content hiding.
- `user_trust_profiles`: moderation trust scores and flags per user.
- `user_top_spots`: user-curated favourite places, surfaced on profile.
- `user_topic_follows`: topic/interest subscriptions (e.g. cuisine categories).
- `saved_places`: places a user has bookmarked. Distinct from collections.
- `push_tokens`: device push tokens. May be stale — delivery failures are expected.

## Ownership

- **Services**: `lib/services/users.ts` (follow/unfollow, profile), `lib/services/users/queries.ts` (getUserProfile, getFollowState, listFollowers, listFollowing), `lib/services/users/mutations.ts` (blockUser, updateUserProfile).
- **ADRs**: follow request privacy lifecycle — ADR-022.
