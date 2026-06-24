# Places Invariants

Business invariants belong in the database where possible.

- `place.status` is authoritative for a venue's operational state. Never infer closure from `place_closure_signals` count alone.
- `place_stats` is derived from `places`, `posts`, and `reactions`. Never treat it as a source of truth. Fix aggregation bugs at source; never patch stats rows directly.
- Place merges are irreversible. `place_merge_events` is a permanent record. The source place is retired and must not be reactivated.
- Search index staleness is expected. Rebuild `place_search_index` from source tables using the rebuild procedure in runbooks. Never patch the index directly.
- A place must have at least one canonical provider record in `place_provider_links` before its status can be set to `active`.
- `place_closure_signals` rows are votes, not verdicts. Status changes only via the designated RPC; the signal count alone does not update `place.status`.
- `place_aliases` protect historical name references after renames. Do not delete alias rows when a place is renamed.
- `place_observations` are point-in-time records. Never update an observation row — append a new one instead.
- `place_opening_hours` reflects the claimed schedule; it is not a real-time open/closed signal. Do not use it as the sole basis for closure decisions.
