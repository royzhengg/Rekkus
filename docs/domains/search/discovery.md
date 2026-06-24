# Search Discovery

Discovery is the zero-query state. Empty query means discovery, not failed search.

## Module Order

Product owns discovery module ordering. Modules are independently evaluated and do not share a global ranking score.

Supported module IDs:

- `near_you`
- `quick_discovery`
- `personal_suggestions`
- `for_you`
- `trending`
- `popular_collections`
- `popular_dishes`
- `popular_places`
- `top_creators`

## Visibility

- Modules may be hidden when insufficient content exists.
- Empty module sections should not render.
- Modules must remain useful with location disabled.
- `near_you` may appear only when a non-precise location context is available or the user has explicitly chosen location.
- Search must never request GPS on mount.

## Search Mode

Search mode begins when the user types or chooses a suggestion.

Search mode includes:

- Expanded command bar
- Sticky intent bar below the command bar
- Typed suggestions
- Active filter summary
- Compact results

Intent bar order:

```text
All, Dishes, Collections, Places, Posts, People
```

Active search results should be compact. Discovery can be more visual.

## Empty States

Every empty state offers recovery actions:

- Expand radius
- Remove filter
- Clear filters
- Switch intent
- Search All
- Show related collections
