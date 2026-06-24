# Search Contracts

Canonical runtime contracts live in `lib/search/filterContracts.ts`.

## Entity Model

```ts
type SearchEntityType =
  | 'dish'
  | 'place'
  | 'collection'
  | 'post'
  | 'person'

type SearchIntent =
  | 'all'
  | 'dishes'
  | 'places'
  | 'collections'
  | 'posts'
  | 'people'

type SearchResultType = SearchEntityType
```

Use explicit unions. Do not derive `people` from `person`.

## Query Flow

```text
Query
↓
Classification
↓
Normalization
↓
Suggestion retrieval
↓
Search execution
```

Classification examples:

- Empty query -> discovery
- `ramen` -> food query
- `gumshara` -> place query
- `best ramen sydney` -> collection query
- `date night` -> occasion query
- `@roy` -> creator query

Normalization uses taxonomy-owned aliases:

```text
taxonomy node -> aliases -> search normalization
```

Search may consume aliases. Search may not create aliases. LLM query rewriting is not part of v1.

## Response Anchor

```ts
type SearchResponse = {
  rankingVersion: string
  results: SearchResult[]
  suggestions?: SearchSuggestion[]
  totalCount?: number
  nextCursor?: string | null
}
```

`rankingVersion` is required for analytics, experiments, and debugging. Cursor pagination is part of the contract.

## Suggestions

```ts
type SearchSuggestion = {
  type: SearchSuggestionType
  id: string
  slug: string
  label: string
  detail?: string
}
```

Suggestions must include stable IDs and slugs. Do not match suggestions by display label.

Default suggestion priority is only a tie-breaker:

1. Food category
2. Cuisine
3. Occasion
4. Collection
5. Place
6. User

Strong exact matches may override default priority.

## View State

```ts
type SearchViewState =
  | 'discovery'
  | 'suggestions'
  | 'results'
  | 'empty'
```

Empty query maps to `discovery`, not `empty`.

## Session Memory

```ts
type SearchSessionStep = {
  query?: string
  intent?: SearchIntent
  filterHash?: string
}
```

Search session memory is in-memory and bounded. Store compact step summaries, not full filter objects.
