# Review Flow UX Checklist

Operational checklist for the Media → Review → Share post creation flow. Evaluate all items before shipping any change to `CreatePostScreen`, `StepMedia`, `StepDetails`, or `StepReview`.

## All Steps

- [ ] Progress always visible — step counter shows "N of 3" alongside step name
- [ ] Primary CTA is visually dominant on every screen (larger height, solid fill)
- [ ] All interactive elements have a descriptive `accessibilityLabel`
- [ ] All touch targets ≥ 44pt (use `<IconButton>` primitive for icon-only actions)
- [ ] No "What's your take?" or generic review framing in any placeholder or prompt
- [ ] Copy is recommendation-first: "What did you try?", "Must order", "What would you recommend?"

## Step 1 — Media

- [ ] Create opens as a root modal route; tab bar is not part of the active create route
- [ ] Title placeholder frames the task as recommendation, not opinion
- [ ] Empty state shows: fact ("no media yet") + next-action prompt (what to do)
- [ ] Empty state copy surfaces dish tagging as a differentiator before photos are added
- [ ] Empty state has a single primary CTA ("Add photos") that opens a `RekkusActionSheet` — not two parallel buttons
- [ ] Dish tagging teaser card visible below upload card when no media is present
- [ ] "Tag dishes" button visible when photos are present
- [ ] Dish tag chips visible and scannable when tags exist
- [ ] "Must Order" field renders on Step 1 (below media strip) when media is present — not Step 2
- [ ] Real-time ✓ validation indicators per section (Title, Media) visible above the scroll area
- [ ] Character counter visible only while the title or Must Order field is focused

## Step 2 — Review

- [ ] Rekkus Picks section: Taste and Value each have ≤ 5 chip options (no decision fatigue)
- [ ] Contextual feedback (`helper` text) appears after each Taste or Value selection
- [ ] Body placeholder prompts for recommendations, not recollection
- [ ] Optional details (Cuisine, Tags) are collapsed by default; expand only if pre-filled
- [ ] Occasion section has ≤ 6 chip options

## Step 3 — Share

- [ ] Post Review / Save Changes button is visually dominant (taller, solid background)
- [ ] Save Draft is visually subordinate — ghost/text style, no border, no fill
- [ ] Posting confidence text visible above the primary action button
- [ ] Media carousel does not obscure review content when scrolled to content area
- [ ] Best dish / Must Order value visible in preview without scrolling (when filled)
- [ ] Edit media and Edit review buttons accessible and clearly labelled

## Product Differentiation

- [ ] "Would Google Reviews or Yelp build this screen the same way?" — if yes, investigate
- [ ] Dish-level recommendation content is more prominent than generic star ratings
- [ ] "Must order" / dish tag content visible in the Share preview
- [ ] The flow guides users toward actionable recommendations, not generic prose

## Accessibility

- [ ] VoiceOver/TalkBack pass on all three steps before shipping
- [ ] No icon-only interactive elements without an `accessibilityLabel`
- [ ] Error states convey failure in text, not colour alone
- [ ] Text legible at OS max text size with no overlap on controls

## Copy Standards (per UX_Copywriting_Guide.md)

- [ ] British English spelling
- [ ] "Tap" not "Click"
- [ ] Sentence case for labels; FULL CAPS only for status badges
- [ ] Error messages: calm, specific, actionable
- [ ] CTAs: active and direct ("Post review", not "Submit")
