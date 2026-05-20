# PR Review Checklist

Owner: Engineering

Use this checklist for manual review and `npm run ops:pr` summaries.

## Checklist

- Scope is small, reversible, and tied to a backlog/product problem.
- Changed files stay within existing owner boundaries.
- Risky changes include rollback, feature-flag, or roll-forward notes.
- Owner docs and backlog rows match implementation truth.
- Docs-only completion is intentional and limited to strategy, policy, indexes, ADR/templates, or external/Roy-owned actions.
- Required checks match the change type.
- Security, release, data, provider, and cost risks are named when touched.

## Review Prompts

- What user behavior or operational problem changed?
- What could silently fail after release?
- What is the smallest follow-up if this is incomplete?
- Which owner doc would become stale if this ships?
