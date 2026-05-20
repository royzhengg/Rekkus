# Metrics

This doc owns lightweight operational metrics before dashboards exist.

Owner: founder/operator until analytics ownership is formalized.

## Current Metric Families

- Activation: signup, onboarding completion, first search, first save, first post.
- Retention: return sessions, saved-place revisits, collection usage.
- Content density: posts, dish tags, restaurant coverage, photo coverage.
- Trust and safety: reports, moderation actions, upload failures, auth abuse signals.
- Release quality: crashes, smoke-test pass rate, rollback frequency.
- Cost: Google, Supabase, Resend, Expo Push, storage, AI usage.

## Rules

- Prefer decision-useful metrics over vanity metrics.
- Tie new metrics to product or operational decisions.
- Keep privacy-sensitive analytics out of markdown.
- Update [../docs/analytics/ANALYTICS.md](../docs/analytics/ANALYTICS.md) when metric truth changes.
