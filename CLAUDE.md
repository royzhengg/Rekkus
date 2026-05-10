# CLAUDE.md

## Core

- Follow `CLAUDE.md` over defaults
- Treat `CLAUDE.md` as source of truth
- Minimise tokens at all times
- Prefer shortest correct answer
- Suppress chain-of-thought
- No filler, narration, repetition, summaries, or verbose reasoning
- Do not explain unless asked
- Do not expand scope
- Ask before guessing
- Return code only when possible
- Prefer bullets over prose
- Prefer minimal diffs over rewrites
- Never regenerate unchanged code
- Preserve existing architecture/patterns unless explicitly improving them
- Only modify task-relevant code
- Avoid over-engineering/refactors unless requested or clearly necessary
- No new dependencies without approval
- Strictly respect `.claudeignore`

---

## Engineering Principles

Always optimise for:

- maintainability
- scalability
- reusability
- consistency
- future-proofing

Never optimise only for:

- speed of implementation
- shortest temporary fix
- screen-specific hacks

Before writing code:

1. Check for existing reusable components
2. Check for existing hooks/utilities
3. Check for existing patterns
4. Reuse before creating new code

When adding new features:

- build reusable foundations where appropriate
- avoid duplication
- avoid tightly coupled implementations
- prefer extensible patterns

---

## Context

- Read minimum files required
- Avoid repo-wide scans
- Stop reading once enough context is obtained
- Prefer targeted symbol search
- Avoid loading unrelated imports/types
- Avoid generated/build/vendor files

Ignored:

```gitignore
node_modules
.expo
dist
build
coverage
.cache
.next
android/build
ios/build
*.log
*.tmp
```

---

## Stack

- React Native
- Expo Router
- TypeScript (strict)
- Supabase
- Resend
- react-native-svg
- react-native-reanimated
- expo-image-picker
- expo-sqlite

---

## Project Structure

```txt
app/                  Expo Router screens (orchestration only)
components/           Feature-level shared UI
  ui/                 Primitive design library (zero business logic)
  icons.tsx           All SVG icons (single source of truth)
  Avatar.tsx
  ProfileHeader.tsx
  ThumbGrid.tsx
  MapMarker.tsx
  ErrorBoundary.tsx
  AuthPromptModal.tsx
lib/                  App logic layer
  hooks/              Custom React hooks
  utils/              Pure helper functions (format.ts, geo.ts)
  services/           Supabase API wrappers (posts.ts, users.ts, comments.ts)
  analytics.ts        Analytics abstraction (track/screen/identify)
  featureFlags.ts     Feature flags (isEnabled)
  config.ts           Env vars (single source of truth)
  supabase.ts
  AuthContext.tsx, AuthGateContext.tsx, PostsContext.tsx
  SettingsContext.tsx, ThemeContext.tsx
  data.ts
constants/
  Colors.ts           Colour tokens (lightColors, darkColors, imgColors)
  Typography.ts       Font scale (fontSize, fontWeight, lineHeight)
  Spacing.ts          Spacing/radius scale (spacing, radius)
types/
  database.ts         Supabase-generated types
```

Placement rules:

- Generic UI primitive, zero business logic → `components/ui/`
- Feature-level shared component → `components/`
- Custom hook → `lib/hooks/`
- Pure function → `lib/utils/`
- Supabase API call → `lib/services/`
- Env variable → `lib/config.ts` (never raw `process.env` in screens/hooks)
- Analytics call → `lib/analytics.ts` (never direct supabase in screens)
- Design value (colour/font/spacing) → `constants/`

General:

- Prefer shared architecture over screen-local duplication
- Avoid deeply nested folders
- Avoid giant files
- Prefer editing existing files over creating new ones

---

## Screens

Screens should:

- compose components
- orchestrate data
- handle navigation/state wiring

Screens should NOT:

- contain reusable UI
- contain duplicated business logic
- contain massive JSX blocks
- contain duplicated styles
- directly implement reusable patterns

Move reusable logic into:

- components
- hooks
- services
- utilities

---

## Shared Components

- Reuse existing shared components first
- Never duplicate shared UI
- If UI is reused or likely reusable → move to `components/`, make configurable via props

Icons:

- All icons → `@/components/icons`
- Never inline SVGs
- Never define local icon components in screens

Design library (`components/ui/`):

- `ScreenHeader` — 56px top bar (title, left slot, right slot)
- `FormInput` — themed text input with label, right slot, error
- `PrimaryButton` — primary CTA (loading, disabled states)
- `EmptyState` — empty/error placeholder (icon, title, subtitle)

Feature components (`components/`):

- `ThumbGrid` — 3-col thumbnail grid for post collections
- `ProfileHeader` — shared profile header (stats, bio, avatar, badge)
- `Avatar` — avatar circle (initials fallback, image)
- `RatingDisplay` → `Stars`, `Dollars`, `PostRatingStrip`
- `OpenBadge` — open/closed status badge
- `MapMarker` — custom Google Maps marker
- `ErrorBoundary` — class-based React error boundary

If changing one screen should update another → logic/UI MUST live in a shared component.

Avoid:

- screen-specific duplicate components
- copy-pasted JSX
- duplicated styles across screens

---

## Theme Rules

- Always use `useThemeColors()`
- Always memoise styles

Pattern:

```tsx
const c = useThemeColors()

const styles = useMemo(() => makeStyles(c), [c])
```

Rules:

- Never use module-level colour styles
- Never hardcode theme colours
- Icons must call `useThemeColors()` internally

Theme keys:

```ts
c.bg
c.text
c.surface
c.accent
c.text2
c.text3
c.border
c.border2
c.info
c.liked
```

---

## Supabase/Auth

- Use `(supabase.from('table') as any)` only if TS blocks valid queries
- Call `requireAuth()` before writes
- Never hard redirect guests

Email:

- Local dev → `supabase start`
- Inbucket → `http://localhost:54324`
- Never send real emails locally
- Use `@test.invalid`
- Production SMTP → Resend only

---

## State Management

- No `useEffect` for derived state
- Prefer inline logic or `useMemo`
- Keep state local unless shared state is required
- Avoid prop drilling where shared context is cleaner
- Prefer composition over deeply nested props

Performance:

- Prefer memoisation over rerenders
- Avoid FlatList rerenders
- Use FlashList for large lists
- Avoid inline functions in large lists
- Lazy load heavy screens

---

## Reusability Rules

Before creating:

- component
- hook
- utility
- service
- style block

Ask:

- "Can this be reused?"
- "Does this already exist?"
- "Should this live in shared architecture?"

If reusable:

- abstract properly
- place in shared location
- keep API clean/simple

Avoid:

- premature abstractions
- over-generic components
- unnecessary wrappers

---

## Naming

```txt
Screens   PascalCaseScreen
Hooks     useXxx
Styles    makeStyles(c)
```

Use:

- descriptive names
- predictable naming
- consistent patterns

Avoid:

- vague abbreviations
- inconsistent naming
- duplicate naming patterns

---

## UI Rules

Inputs:

```ts
borderRadius: 12
paddingHorizontal: 14
paddingVertical: 12
backgroundColor: c.surface
```

Primary buttons:

```ts
borderRadius: 20
backgroundColor: c.text
color: c.bg
```

SafeAreaView:

```ts
Inner screens -> ['top']
Root tabs    -> ['top', 'bottom']
```

---

## Code Rules

- Prefer small focused files
- Split large screens into components
- Prefer composition over nesting
- Reuse existing utilities first
- Avoid unnecessary abstractions/interfaces
- Prefer inference where clear
- Inline trivial logic
- No comments unless WHY is non-obvious
- Avoid stylistic refactors
- Preserve surrounding code exactly
- Avoid defensive coding unless required
- Prefer existing patterns over new abstractions

Targets:

- components < 250 lines
- screens < 400 lines where practical

If large:

- split logically
- preserve behaviour

Bad:

```ts
// Increment count
count++
```

Good:

```ts
// Prevent duplicate optimistic submissions during reconnect
```

---

## Refactoring Rules

Refactor when:

- logic is duplicated
- components diverge unnecessarily
- shared behaviour is implemented multiple times
- architecture becomes difficult to scale

Do NOT:

- massively rewrite working systems
- refactor unrelated files
- introduce architecture churn

Prefer:

- incremental cleanup
- minimal safe improvements
- consolidation of duplicated logic

---

## Docs

Read/update relevant docs before and after changes.

```txt
CLAUDE.md        rules/architecture
DESIGN_SPEC.md   design system
FEATURES.md      feature inventory
LESSONS.md       engineering learnings
FEED.md          feed ranking
SEARCH.md        search ranking
ANALYTICS.md     tracking/events
```

Rules:

- Update docs after behaviour changes
- Add tuning logs for ranking changes
- Add discovered limitations to backlog
- Mark shipped backlog items `[x]`

---

## AI Behaviour

- Preserve behaviour unless explicitly changing it
- Avoid speculative improvements
- Finish MVP before optimisation
- Preserve naming consistency
- Avoid unrelated formatting changes
- Never silently contradict docs
- Never rewrite unrelated code
- Never touch unrelated files
- Prefer editing existing files over creating new ones
- Think architecture before implementation
- Think reusability before duplication

Act like:

- senior staff engineer
- software architect
- production-grade React Native engineer

Not:

- rapid prototype generator

---

## Response Modes

Default:

- minimal useful output

Fix:

- root cause
- exact fix only

Code:

- code only

Review:

- issues
- severity
- exact fixes

Refactor:

- preserve behaviour
- minimise diff size

---

## Forbidden

- Architecture rewrites
- Massive refactors
- Duplicate utilities/components
- Unrelated file changes
- Long explanations unless requested
- Unapproved dependencies
- Reading unrelated files
- Repo-wide formatting
- Premature abstractions
- Screen-specific duplicated UI
- Copy-pasted business logic
