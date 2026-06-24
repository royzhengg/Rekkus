# Places Lifecycle

## 1. Place Status

```text
proposed
 └─ admin/RPC approve  -> active

active
 ├─ signal threshold + RPC  -> flagged
 └─ admin/RPC close         -> closed
 └─ admin/RPC merge         -> merged  (IRREVERSIBLE)

flagged
 ├─ admin/RPC confirm        -> closed
 └─ admin/RPC dismiss        -> active

closed   -> terminal
merged   -> terminal (source place retired; target place absorbs history)
```

- `place.status` is the single authoritative field. Never infer from `place_closure_signals` alone.
- Merges are permanent. `place_merge_events` records the event. Do not attempt to reverse.
- Status transitions happen via RPC only — never direct UPDATE from app code.

## 2. Place Closure Signal Lifecycle

```text
signal submitted (user reports closed)
 └─ signal_count incremented in place_closure_signals
     └─ threshold check runs (via trigger or scheduled job)
         ├─ threshold not met  -> no status change
         └─ threshold met      -> RPC sets place.status = 'flagged'
```

Signals are votes, not verdicts. The RPC (not the signal row) changes status.

## 3. Place Ownership Claim

```text
submitted (user claims ownership)
 └─ pending
     ├─ admin approves  -> approved  (place_owners row created)
     └─ admin denies    -> denied    (terminal)
```

- Only one active ownership claim per place at a time.
- Approved owners may manage hours, contact info, and respond to reviews.
