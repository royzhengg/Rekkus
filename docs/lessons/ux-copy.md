# Lessons: UX Copy Standards

Always consult `design/UX_Copywriting_Guide.md` when designing new features or flows — even if specific rules are later overridden, it is the required starting point for copy decisions.

## Rules

- **British English** is the spelling standard throughout the app
- **Full caps only for status labels** (e.g. `ACTIVE`, `PENDING`) — never for section headings, modal titles, or button labels
- **Use "Tap" / "return"** — never "Click" / "enter" — this is a mobile app
- **"Create account"** is the canonical term everywhere — never "Sign up"
- **CTAs must be specific** — "Complete profile", "Post review", "Update password" — never "Finish", "Submit", or "OK" in isolation
- **Empty states**: state the fact cleanly and prompt the next action — remove passive filler like "Check back later"
- **Error messages**: always say what happened and what to do next — "That password doesn't match. Please try again." not "Current password is incorrect."
- **Industry terms** like "privacy policy" and "terms of service" are lowercase — they are not proper nouns
- **Placeholders** should match their label when they add no independent value (e.g. a "Confirm password" label → "Confirm password" placeholder, not "Repeat password")

## Error message copy (2026-05-30)

- **"Something went wrong" is the canonical generic string to eliminate.** It names neither the failure nor the remediation. Replace with the surface ("This section ran into a problem") + a clear action ("Tap Try again to reload it.").
- **Raw `error.message` must never be shown in production UI.** `ErrorBoundary` was displaying `this.state.error.message` verbatim — a raw JS exception string. The crash is already forwarded to Sentry via `captureCrash`; the UI only needs calm guidance copy. Replace with a fixed actionable message.
- **"Failed to update X" is abrupt and provides no path forward.** The canonical replacement is "Your X could not be updated. Check your connection and try again." — it names the failure, removes the blame-y "Failed" framing, and tells the user exactly what to do.
- **"Please try again." alone is insufficient when it's the entire message.** It provides a direction but no failure context. It is only acceptable when it follows a sentence that already names what failed (e.g., "That password doesn't match. Please try again."). Standalone fallbacks must say *what* to check: "Check your connection and try again."
- **Guardrail:** `scripts/check-error-copy.js` (`npm run check:error-copy`, wired into `check:hygiene`) rejects banned patterns at CI time. Add `// check-error-copy:allow` only with a justification.

## First-Time Feature Discovery (2026-05-31)

- **Core differentiators are invisible until the user takes an action.** Dish tagging only becomes visible after a photo is added, so first-time users miss it entirely. Discoverable features must have a first-time disclosure mechanism — an inline hint, tooltip, or coach mark — that appears at the moment the feature first becomes relevant.
- **AsyncStorage gates are the right tool for one-time disclosure.** Key convention: `rekkus:<feature>:v1`. Check on mount (`getItem` → set state), show on first trigger, write `'1'` synchronously with showing so a crash cannot replay it. Always initialize shown-state to `true` to prevent a flash before AsyncStorage resolves.
- **Inline hint cards outperform full-screen coach marks for contextual disclosures.** An inline card between content and the action it points to reads as contextual guidance, not an interruption. Full-screen overlays with spotlights are appropriate only for actions with no adjacent anchor point.
- **Dismiss must be 44pt and labelled.** `accessibilityRole="button"`, `accessibilityLabel="Dismiss tip"`, `minWidth/minHeight: 44`, `hitSlop={8}`.
- **Always fire an analytics event when a one-time onboarding surface appears.** `dish_tag_onboarding_shown` tracks adoption funnel reach — without it, you cannot tell if the tooltip showed but tagging still didn't increase.

## Create-Post Flow (2026-05-30)

- **Review framing vs recommendation framing:** "What's your take?" positions Rekkus as a review platform. "What did you try?" positions it as a recommendation platform. Small placeholder copy shifts perceived product identity.
- **Progress dots without labels violate Nielsen Heuristic #1.** Dots alone tell users where they are but not how far they have to go. Always pair a step counter ("1 of 3") with the step name.
- **Contextual feedback after verdict selection reduces abandonment.** Helper text appearing after a Taste or Value chip is selected gives users confidence their choice made sense and reduces the urge to abandon. The `helper` property on `TASTE_PICK_OPTIONS` / `VALUE_PICK_OPTIONS` already implements this — do not remove it.
- **Dish tagging is invisible until photos are added.** Surface it in empty-state copy before the user adds media so they arrive at the tagging feature with intent, not surprise.
- **Save Draft and Post on the same level of visual weight creates decision fatigue at the moment of highest commitment.** Make Save Draft ghost/text-only so the primary action is unambiguous.
- **"Must order" is stronger recommendation framing than "Best dish."** Use action-oriented language for fields that drive food discovery decisions.
- **Posting confidence copy reduces pre-submission abandonment.** A single line ("Your review helps others discover great food.") addresses loss aversion at the point of highest drop-off risk. Place it directly above the primary action button.

## Zero-results states (2026-05-31)

- **A blank screen is never an acceptable zero-results state.** Users who hit zero results have nowhere to go and bounce. Always offer ≥2 forward actions (chips, suggestions, or a clear next step). A message alone ("No results for X") is insufficient.
- **`NoResultsCard` is the canonical pattern for search zero-results.** It renders "No results for X" + 3 alternative chips from `CHIPS` in `searchConstants.ts`. Do not add a new inline dead-end block to `SearchScreen.tsx` — extend `NoResultsCard` if the alternatives need to change.
- **Regression guard:** `tests/unit/NoResultsCard.test.tsx` asserts that the card always renders ≥2 chip buttons. If the test fails after a search refactor, the dead-end has been re-introduced.
