# Analytics Events

This doc owns event naming, event payload rules, and event review before analytics changes ship.

## Event Contract

Events flow through [../../lib/analytics.ts](../../lib/analytics.ts) into `analytics_events`.

| Field | Rule |
| --- | --- |
| `event_type` | Stable snake_case action name. |
| `entity_type` | Use canonical entities such as `restaurant`, `post`, `dish`, `collection`, or `user` when applicable. |
| `entity_id` | Use canonical UUIDs only. |
| `metadata` | Minimal, privacy-safe JSON. |

## Privacy Rules

Do not store emails, phone numbers, addresses, secrets, raw provider payloads, private notes, precise location, auth tokens, reset links, or payment data in analytics metadata.

Metadata should be categorical, bounded, and useful for product decisions or ranking diagnostics.

Private-account and activity-visibility events may record only categorical state changes:
`follow_request_state_changed.action` (`sent`, `approved`, `declined`, `approved_immediate`, `approved_bulk`, `declined_bulk`, `approved_auto_public`) and `privacy_setting_changed.{setting, enabled}`. Do not include profile names, requester/target usernames, captions, places, tags, media URLs, or message presence timestamps.

## Saved Library Events

- `dish_view` and `dish_save` use canonical `dish.id` only and do not carry dish text, location, or provider data.
- `collection_interaction` may carry bounded `action` and `target_type` values with canonical collection IDs.
- B-283 records these interactions for product understanding only; dish save/view events are not ranking, trending, or recommendation inputs until separate backlog scope ships.

## Event Review Checklist

- Does this event answer a real product, quality, or operational question?
- Is the payload privacy-safe?
- Is the name stable and searchable?
- Does it duplicate an existing event?
- Is the event documented in [ANALYTICS.md](ANALYTICS.md) if it affects ranking, funnels, or dashboards?
