# ADR-0033: Google OPERATIONAL Sync Strategy

**Status:** Accepted  
**Date:** 2026-06-26  
**Deciders:** Roy Zheng  
**Ticket:** B-611  
**Depends on:** [ADR-0032](ADR-0032-mention-notification-pipeline.md), `20260624000006_closed_venue_detection.sql`

---

## Context

B-601 shipped `place_closure_signals` and `reopen_place()`. Without a scheduled worker, `reopen_place()` is never called automatically — venues that Google marks OPERATIONAL after a closure remain incorrectly marked in our DB until a user views their page. This ADR records the key decisions made in designing the B-611 sync job.

---

## Decisions

### 1. Advisory locking over transaction locking

**Choice:** `pg_try_advisory_lock` / `pg_advisory_unlock` as session-scoped RPCs called from the Edge Function.

**Rejected:** `pg_advisory_xact_lock` (transaction-scoped) — not suitable here because the lock must span the entire Edge Function invocation, which executes across multiple DB calls, not within a single transaction.

**Rejected:** Application-level locking (Supabase Realtime presence, Redis) — unnecessary dependency for a once-daily job.

**Safety property:** Advisory locks are session-scoped, so if the Edge Function crashes before calling `release_google_sync_lock()`, the lock is released automatically when the Supabase pooler recycles the underlying DB connection. The `try/finally` guard in the Edge Function is a belt-and-suspenders measure.

---

### 2. Retry strategy: exponential backoff with jitter, 3 total attempts

**Choice:** Retry `UNKNOWN_ERROR` and network timeouts up to `TOTAL_ATTEMPTS = 3` (1 initial + 2 retries), base delay `RETRY_BASE_MS = 500 ms` with ±250 ms jitter.

**Rationale:** Google's `UNKNOWN_ERROR` is documented as transient. Exponential backoff prevents thundering herd against Google when the error is widespread. Jitter prevents multiple concurrent requests from retrying in lockstep. Hard cap at 3 keeps worst-case per-place latency under 4 s, acceptable within the Edge Function 120 s timeout.

**Rejected:** Unlimited retries — risks burning quota and extending job runtime indefinitely.

---

### 3. Circuit breaker at 20 consecutive errors

**Choice:** `MAX_CONSECUTIVE_ERRORS = 20` — abort the batch with `abort_reason = 'CIRCUIT_BREAKER'`.

**Rationale:** 20 consecutive errors across different places (not the same place retried) strongly indicates a systemic issue (key revoked, quota exhausted, network partition) rather than bad data. Aborting fast limits wasted API calls and surfaces the incident in cron run logs promptly.

**Tuning:** Lower to 10 if false-positive aborts appear in production; raise to 50 if legitimate transient spikes exceed 20 places regularly.

---

### 4. Provider cache TTL: 30 days

**Choice:** `PROVIDER_CACHE_TTL_DAYS = 30` → `stale_at = now() + 30 days`.

**Rationale:** Google Places API Terms of Service require cached data to be refreshed within 30 days. Using 30 days as the TTL means every place is checked at most once per month, and the daily cron naturally processes places in staleness order (oldest-first).

**Operational implication:** At launch with a small place catalogue, all places re-enter the queue approximately monthly. When the catalogue grows, the daily `GOOGLE_SYNC_BATCH_SIZE` cap limits throughput — scale the batch size or add the indexed queue column (see scalability note below).

---

### 5. Permanently closed recheck interval: 90 days

**Choice:** `stale_at < now() - interval '90 days'` in `get_places_for_google_sync`.

**Rationale:** Places do occasionally transition from permanently closed back to OPERATIONAL (ownership transfers, renovation reopens). 90 days balances rechecking cost against the latency of surfacing a genuine reopening. A shorter interval risks redundant API calls; a longer interval leaves users looking at a stale closure badge for months after a real reopen.

---

### 6. Idempotency patch on `reopen_place()`

**Choice:** Early-return guard added to `reopen_place()` in the same migration:
```sql
IF v_status = 'active' AND NOT EXISTS (
  SELECT 1 FROM place_closure_signals
  WHERE place_id = p_place_id AND signal_value = 'closed' AND resolved_at IS NULL
) THEN RETURN; END IF;
```

**Rationale:** The Edge Function reads `place_status` from the batch query, then calls `reopen_place()` after a Google API round-trip. Between those two operations, another process could have already reopened the place. Pushing the idempotency check into the DB function eliminates the race entirely and makes `reopen_place()` safe to call from any caller without a prior status check.

---

### 7. Closure signal insert replicates `applyProviderClosureSignal` inline

**Choice:** The Edge Function inserts directly into `place_closure_signals` rather than calling the TypeScript `applyProviderClosureSignal` function from `lib/services/places.ts`.

**Rationale:** `applyProviderClosureSignal` is a client-side module that imports Supabase browser types and is not importable in a Deno Edge Function. The insert logic is simple enough (one row, one table, one error code to catch) that replication adds no meaningful maintenance burden.

**Invariant to maintain:** If `applyProviderClosureSignal` adds new metadata fields, update the Edge Function's metadata object to match.

---

### 8. Scalability trigger

The current `get_places_for_google_sync` function does an `ORDER BY c.stale_at ASC NULLS FIRST, p.id` scan backed by `idx_ppc_google_sync`. This is efficient up to a few hundred thousand rows.

**Trigger to revisit:** When the places table exceeds ~500k rows or the job routinely runs > 5 minutes, add a `next_google_sync_at TIMESTAMPTZ` indexed column to `places`. This converts the join + sort into a direct `WHERE next_google_sync_at <= now() ORDER BY next_google_sync_at` index seek, reducing query cost from O(n log n) to O(batch_size).

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|-----------------|
| React Native app triggers sync on place view | Already B-600/B-601 (user-triggered). B-611 is the scheduled complement for places with no recent views. |
| Single SQL cron job with pg_net (no Edge Function) | Google response parsing, retry logic, and circuit breaker are too complex for PL/pgSQL; TypeScript is the right tool. |
| Separate cron jobs per business status | Unnecessary complexity; one job handles all three outcomes with a single Google API call per place. |
| Use `pg_advisory_xact_lock` | Transaction-scoped; released on commit, not end of function. Correct only for intra-transaction locking. |
