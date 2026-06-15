---
name: review-feature
description: Review a feature or branch against three axes — Standards (repo conventions), Spec (BACKLOG item or PRD), and Rekkus-specific checks (analytics, animations, type safety, doc updates). Runs axes as parallel sub-agents and reports them side by side. Use when user wants to review a feature, check a branch, audit a PR, or says "review feature", "check my work", "did I miss anything", or "is this done".
---

# Review Feature

Three-axis review of a feature diff. Axes run as **parallel sub-agents** so they don't pollute each other's context.

## 1. Pin the Scope

If the user didn't specify, ask: "Review which branch or commit — or should I diff against `main`?"

Default if they say "current work": `git diff main...HEAD` (three-dot, compares against merge-base).

Also capture: `git log main..HEAD --oneline`

## 2. Find the Spec

Look for the originating spec in this order:

1. BACKLOG.md — find the row by ID (from branch name or commit messages) or description match
2. An argument the user passed (file path or issue reference)
3. A PRD/spec file under `docs/`, `product/`, or `specs/`

If nothing found: the **Spec sub-agent** will skip and report "no spec available".

## 3. Spawn 3 Sub-Agents in Parallel

Send a single message with three `Agent` tool calls using `subagent_type: general-purpose`.

---

**Standards sub-agent** — does the code follow repo conventions?

Brief: Read `AGENTS.md`, `CLAUDE.md`, `REPO_MAP.md`, and any ADRs in `docs/adr/`. Then read the diff. Report every place the diff violates a documented standard. Cite the rule (file + rule). Distinguish hard violations from judgment calls. Under 300 words.

Key things to flag:
- Wrong file placement (logic in `app/`, business logic in `components/ui/`, etc.)
- `lib/mocks` imported from `app/` or `features/`
- New dependency added without justification
- Missing or broken type exports in `types/domain.ts`

---

**Spec sub-agent** — does the code deliver what was asked?

Brief: Read the spec (BACKLOG.md row or PRD). Then read the diff. Report: (a) requirements that are missing or partial; (b) behaviour in the diff not asked for (scope creep); (c) requirements that look implemented but appear wrong. Quote the spec for each finding. Under 300 words.

---

**Rekkus-specific sub-agent** — does the code meet Rekkus quality gates?

Brief: Read the diff and check these four areas. Under 300 words total.

1. **Analytics** — does every new screen/interaction/exit have an analytics event via `lib/analytics.ts`? Check `docs/analytics/ANALYTICS.md` for naming conventions.
2. **Animations** — are all animations using tokens from `lib/animations.ts`? Flag any inline spring configs or legacy `Animated` API usage.
3. **Type safety** — run `npx tsc --noEmit`. Report any new errors introduced.
4. **Doc updates** — cross-check the end-of-task checklist: is BACKLOG.md updated? Are ARCHITECTURE.md, REPO_MAP.md, SECURITY.md, or product docs updated where needed? Are new lessons recorded?

---

## 4. Aggregate

Present the three reports under:

```
## Standards
## Spec
## Rekkus Checks
```

Do **not** merge or rerank findings — the axes are deliberately separate.

End with a one-line summary: findings per axis and the single worst issue (if any).
