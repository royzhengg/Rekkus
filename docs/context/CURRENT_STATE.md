# Current State

> **This file decays fast.** Update when backlog priorities shift, a domain ships, or an ADR is accepted. The agent that ships or accepts the change owns the update.

## Active Backlog Areas

- **Places domain** — closure signal pipeline, place merge tooling, provider enrichment
- **Search** — ranking signal improvements, embedding freshness, semantic search coverage
- **Messaging** — offline queue phase 2 (B-239b), delivery reliability
- **Offline writes** — offline queue phase 1 shipped (6 mutation types); phase 2 deferred
- **Analytics** — event coverage gaps across feed and search flows
- **Private account activity visibility** — follow request privacy, Alerts filtering
- **User trust profiles** — moderation integration, trust score surfacing

## Recent ADRs

- **ADR-021** — Social events ledger (append-only; single source for Alerts)
- **ADR-022** — Follow request privacy lifecycle (separate tables; terminal states)
- **ADR-023** — Schema-first development (schema.sql generated; never hand-edit)

## Active Domains

- **places** — venue data, status, stats, search index
- **users / social** — profiles, follows, blocks, privacy
- **content** — posts, dishes, reactions, comments, likes
- **messaging** — conversations, messages, deliveries
- **collections** — user-curated place lists
- **search** — derived indexes, embeddings, ranking, analytics
