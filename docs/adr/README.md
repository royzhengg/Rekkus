# Architecture Decision Records

ADRs record durable decisions so Rekkus does not repeatedly re-litigate the same architecture, product, security, or operations tradeoffs.

## Naming

Use sequential four-digit IDs:

`0001-short-kebab-title.md`

Keep one decision per file. If a later decision replaces it, create a new ADR and mark the old one `Superseded`.

## Statuses

- `Proposed`: under discussion, not yet operating truth.
- `Accepted`: current operating truth.
- `Superseded`: replaced by a later ADR.
- `Rejected`: considered and intentionally not adopted.

## Required Sections

- Status
- Context
- Decision
- Consequences
- Rollback or Revisit Trigger

Start from [0000-template.md](0000-template.md).

