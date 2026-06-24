# Search Analytics

Search analytics measure decision quality without storing raw provider payloads or precise coordinates.

## Events

| Event | Purpose | Metadata |
| --- | --- | --- |
| `search_filter_sheet_opened` | User opens the filter sheet | `{ filter_count }` |
| `search_suggestion_selected` | User chooses a typed suggestion | `{ suggestion_type, suggestion_id, suggestion_slug, position }` |
| `search_no_results` | Search returns no results | `{ query, result_type?, ranking_version? }` |
| `search_saved_search_used` | User runs a saved search | `{ query, search_session_id? }` |
| `search_filter_applied` | User applies a filter | `{ filter_type, filter_id }` |
| `search_filter_removed` | User removes a filter | `{ filter_type, filter_id }` |

Metadata rules:

- Filter metadata uses type + slug/id only.
- `ranking_version` is allowed.
- Do not include raw result payloads.
- Do not include provider payloads.
- Do not include precise coordinates.

## Health Metrics

- Result click-through rate
- No-result rate
- Suggestion selection rate
- Search refinement rate
- Search abandonment rate
- Saved-search usage rate
- Collection click-through rate
- Time-to-first-click
- Filter usage rate
- Nearby prompt conversion rate

## Performance Signals

- Full search debounce: 250-300ms.
- Suggestions stay faster and bounded.
- Invalidate/cancel in-flight work on query, filter, or intent changes.
- Ignore stale responses by request id.
- Only latest request updates visible state.
- Use skeletons for predictable loading.
