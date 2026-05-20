# Documentation Governance

This doc owns how Rekkus documentation stays useful, current, and small enough for humans and agents to scan.

Authority order still lives in [../AGENTS.md](../AGENTS.md). This file turns that order into operating rules.

---

## Owners

| Area | Owner Doc |
| --- | --- |
| Strategy | [../PRODUCT.md](../PRODUCT.md) |
| Execution order and shipped history | [../BACKLOG.md](../BACKLOG.md) |
| AI/operator behavior | [../AGENTS.md](../AGENTS.md) |
| Repo navigation | [../REPO_MAP.md](../REPO_MAP.md) |
| Architecture and code ownership | [architecture/ARCHITECTURE.md](architecture/ARCHITECTURE.md) |
| Security, auth, storage, abuse | [security/SECURITY.md](security/SECURITY.md) |
| Analytics and measurement | [analytics/ANALYTICS.md](analytics/ANALYTICS.md) |
| Release and beta operations | [../operations/RELEASE.md](../operations/RELEASE.md), [../operations/BETA.md](../operations/BETA.md) |
| Product behavior | [../product/README.md](../product/README.md) |
| Design and UI | [../design/README.md](../design/README.md) |
| Durable decisions | [adr/README.md](adr/README.md) |

If a change fits an existing owner, update that owner instead of creating a parallel doc.

---

## Knowledge Lifecycle

Use this lifecycle for meaningful docs:

1. Draft: useful but incomplete. Include owner, scope, and next decision.
2. Active: current operating truth. Link it from the nearest owner index.
3. Superseded: no longer the rule, but historically useful. Add a superseded note and link to the replacement.
4. Archived: kept only for historical context. Move only when there is a clear archival owner.
5. Deleted: allowed when the content is duplicate, obsolete, and not needed for history.

Staleness triggers:

- The implementation changes and the doc still describes old behavior.
- The doc names an owner, route, service, table, event, or workflow that no longer exists.
- Two docs answer the same operational question differently.
- A backlog item ships but the related doc still describes it as future work.
- A backlog item that implies runtime behavior, automation, validation, auditability, jobs, privacy workflow, media safety, or release gating ships as docs-only without implementation evidence.
- A doc has not been touched across a major product direction, release, or folder restructure that affects it.

When a stale doc is found, either update it in the same change, mark it superseded with a replacement link, or add a correctly placed backlog item.

Docs-only completion is acceptable for strategy, owner indexes, policy, ADR templates, and intentionally deferred external/legal work. For implementation-shaped backlog rows, update the code, migration, automation, or guardrail first, then update docs/backlog to match.

---

## Documentation Budgets

Budgets keep docs dense and operational. They are guidelines, not a reason to delete important truth.

| Doc Type | Target Size | Budget Rule |
| --- | --- | --- |
| Root authority docs | Up to 250 lines | Entry points only; link deeper detail out. |
| Owner index docs | Up to 180 lines | Explain what lives in the folder and where to go next. |
| Domain references | Up to 350 lines | Keep current rules, tables, workflows, and links. |
| ADRs | Up to 120 lines each | One decision per file. Prefer context, decision, consequences. |
| Backlog items | One table row each | Preserve history; put long explanation in owner docs. |
| Strategy docs | Up to 300 lines | Avoid duplicating execution checklists. |

When a doc exceeds its budget, first remove duplication and stale prose. Split only when there is a clear new owner folder or recurring operational question.

---

## ADR Policy

Create an ADR when a decision is durable, expensive to reverse, or likely to be rediscovered later.

Use an ADR for:

- Architecture boundaries or ownership changes.
- Provider choices and dependency decisions.
- Data model decisions.
- Security, release, or moderation policy decisions.
- Product constraints that intentionally reject a tempting alternative.

Do not use an ADR for:

- Small implementation details obvious from code.
- Temporary experiments with expiry dates.
- Backlog items that do not yet have a decision.

ADR files live in [adr/](adr/) and use the template in [adr/0000-template.md](adr/0000-template.md).
