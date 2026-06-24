# Stuck Notification Deliveries

1. Inspect `notification_deliveries` where `status='pending'` and `next_attempt_at < now()`.
2. Confirm the source `social_event` still exists.
3. Confirm recipient notification settings in `user_settings`.
4. Retry through the delivery worker; do not send push directly from the database.

