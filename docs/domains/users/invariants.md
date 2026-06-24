# Users Invariants

Business invariants belong in the database where possible.

- `follow_requests` and `follows` are separate tables — never conflate them. An approved request creates a row in `follows`; the request row remains as a terminal record.
- A user cannot follow or request to follow themselves. Enforced at DB level.
- Only one pending follow request may exist per requester-target pair at any time.
- Blocking a user cancels all pending follow requests between the pair (in both directions) and hides existing content from both parties.
- `user_blocks` are directional for initiation but symmetric for content hiding. Both parties lose visibility of each other's content regardless of who initiated.
- `user_settings` rows are always present — created atomically with the `users` row. Never write code that null-checks `user_settings` without a guaranteed fallback.
- `push_tokens` may be stale if a device was unregistered or the app was reinstalled. Delivery failures are expected and must not be treated as hard errors.
- Privacy mode change from private → public must atomically approve or cancel all pending `follow_requests`. No pending requests may remain after the transition.
- `user_trust_profiles` is managed by the moderation pipeline. Never update trust scores from app code directly.
