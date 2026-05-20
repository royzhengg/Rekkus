# Product UX

Product UX owns the product-level experience rules for Rekkus. Visual tokens and component implementation live in [../design](../design).

## UX Direction

Rekkus should feel like a fast food-decision utility: visual, local, opinionated, and specific. The app should help users find a dish or place worth saving with minimal ceremony.

## Messaging UX Direction

Messaging is utility, not social performance. The UI should feel immediate and frictionless — a tool to coordinate food plans, not a feature to explore. Media shared in messages should be food-forward. Typing indicators and online status are non-intrusive; they appear inside the conversation only, never in the feed or search. Conversation creation is lightweight: one tap from a profile, post, or place. Group creation requires a name and at least 2 other members; no mandatory avatar.

## Create UX Direction

Create should feel like a food note composer, not a generic review form. The opening order is title, restaurant/place, then food media so the intent is clear before optional enrichment. The composer supports camera capture, a unified mixed photo/video library picker, local media preparation, account-synced saved drafts, invisible autosave recovery, photo-only dish tagging, Rekkus Picks helper-copy chips, searchable cuisine, and a publish preview without fake engagement chrome.

The tab bar `+` is a context-preserving launcher, not a hidden return-to-last-create-state shortcut. When saved drafts exist it opens a Rekkus sheet over the current screen with **New post** and **Edit a draft** only; the draft list itself stays in `/create/drafts`.

Saved drafts are intentional user objects, not every keystroke in history. When saved drafts exist, tapping Create should first open a Rekkus-style choice sheet for **New post** or a saved draft so users do not accidentally resume old work. Keep autosaves hidden unless needed for recovery. Let users save from any create step, and when editing a saved draft, offer **Save draft** versus **Save as new draft** so branching does not overwrite the original. Draft save confirmations should use in-app Rekkus UI, not platform-default alerts.

Search should feel compact until the user expresses intent. Keep the input primary, show Quick starts before typing, reveal result tabs after query/Nearby, and keep cuisine/occasion/value/media/open-now/sort controls in the filter sheet with quiet active tokens.

## Core UX Rules

- Make food content the first visible signal whenever possible.
- Prefer saves, dish tags, ratings, and collections over generic social engagement.
- Keep maps useful but secondary to food intent.
- Use progressive disclosure for provider details, metadata, and operational complexity.
- Empty states should ask for the next useful contribution or search, not apologize vaguely.
- Auth gates should protect writes without blocking read/explore value unnecessarily.

## Key Moments

| Moment | UX Goal | Owner |
| --- | --- | --- |
| First open | Show useful food content quickly | [ACTIVATION.md](ACTIVATION.md) |
| Search | Resolve intent and avoid dead ends | [SEARCH.md](SEARCH.md) |
| Restaurant detail | Make saving and dish discovery obvious | [DISCOVERY.md](DISCOVERY.md) |
| Create review | Capture dish/place specificity without heavy friction | [CONTRIBUTION_LOOPS.md](CONTRIBUTION_LOOPS.md) |
| Saved content | Make repeat food intent easy to return to | [RETENTION.md](RETENTION.md) |

## Copy Boundaries

- Use concrete food language over generic social-platform copy.
- Avoid overclaiming AI, personalization, or recommendation quality before the graph supports it.
- Use "Places" for the visible restaurant tab unless product direction changes.
- Keep error messages actionable and calm.

## Related Docs

- [../design/DESIGN_SPEC.md](../design/DESIGN_SPEC.md)
- [../design/UI_LIBRARY.md](../design/UI_LIBRARY.md)
- [../design/UX_Copywriting_Guide.md](../design/UX_Copywriting_Guide.md)
