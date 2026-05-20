# Rekkus — Phase 0 Audit

Conducted: 2026-05-20. Three parallel Explore agents audited architecture, UX/design system, and operations. All findings synthesised here. Every actionable is in `backlog_new.md`.

---

## 1. Executive Summary + Score Card

| Dimension | Score | Key Evidence | Confidence | Regression Risk | Complexity |
| --- | --- | --- | --- | --- | --- |
| Architecture structure | 8/10 | Correct folders; service boundary violated in 3 screens | High | Medium | Medium |
| Design token adoption | 3/10 | Tokens defined; 74 hardcoded hex + 1,000+ hardcoded spacing/fontSize in features | High | High | Medium |
| Dark mode quality | 5/10 | Context correct; auth screens white-on-white; overlays hardcoded | High | High | Low |
| Component consistency | 4/10 | 5 empty state patterns; 15+ chip variants; 34 inline icon buttons | High | Medium | Medium |
| Screen complexity | 4/10 | ConversationScreen 2,375 LOC; SearchScreen 1,893 LOC; PostDetailScreen 1,290 LOC | High | High | High |
| Type safety | 5/10 | 220 `as any` instances; 0% test coverage | High | High | High |
| Service boundary | 6/10 | 3 screens bypass service layer with direct supabase calls | High | Medium | Low |
| Accessibility | 4/10 | No a11y audit; no reduced-motion; icon buttons at 34px (below 44pt HIG) | Medium | Medium | Medium |
| Performance | 6/10 | Hermes + New Architecture enabled; premature memoization; 7 providers in cold start | Medium | Medium | Low |
| Media / network | 6/10 | Compression exists; no upload retry; no skeleton loading | High | Low | Medium |
| Copywriting compliance | 6/10 | UX_Copywriting_Guide exists; per-screen compliance not verified | Medium | Low | Low |
| HIG / Material3 | 5/10 | 34px touch targets; fontSize:10 in chips; no swipe-to-dismiss audit | Medium | Medium | Medium |
| Responsive layout | 4/10 | No tablet strategy; hardcoded pixel widths assumed | Medium | Low | High |
| Trust / safety | 7/10 | RLS in place; rate limiting unverified; moderation deferred | High | Low | Medium |
| Operations / CI | 9/10 | 42 npm scripts; 16 CI checks; 0 vulnerabilities; lint not PR-gated | High | Low | Low |
| Documentation | 10/10 | 50+ docs; complete governance; authority order enforced | High | Low | Low |
| Analytics | 8/10 | Strong sanitization; no event versioning or sampling strategy | High | Medium | Low |
| Feature flags | 8/10 | 32 well-structured flags; no DB emergency override | High | Medium | Medium |
| Startup efficiency | 7/10 | Lean deps; cost governance; B-004 provider restrictions still open | High | Low | Low |
| AI-agent readiness | 9/10 | AGENTS.md, LESSONS.md, REPO_MAP.md present; clear authority order | High | Low | Low |
| Scalability | 7/10 | Service layer abstracts DB; god components limit parallel work | High | High | High |
| Maintainability | 6/10 | God components + 220 `as any` + 0 tests are compounding liabilities | High | High | High |

**Headline:** The operational and documentation systems are exceptional (9–10/10). The code execution layer has meaningful gaps — design token adoption (3/10), component consistency (4/10), and screen complexity (4/10) are the highest-leverage targets before beta.

---

## 2. Architecture Audit

### Folder Structure vs AGENTS.md Rules

✓ `app/` — Expo Router wrappers only; all screen files re-export from `features/`
✓ `features/` — screen implementations present
✓ `lib/services/` — 16 service files, ~3,861 lines
✓ `lib/hooks/` — 15 hooks, ~2,151 lines
✓ `lib/contexts/` — 7 React providers, ~649 lines
✓ `lib/mocks/` — present; `lib/data.ts` re-exports correctly
✓ `types/domain.ts` — app-facing domain types, well-structured
✓ `types/database.ts` — generated Supabase types

### Service Boundary Violations

Three screens bypass `lib/services/` with direct supabase calls — violating AGENTS.md and making logic untestable:

| Screen | Violations | Root Cause |
| --- | --- | --- |
| `features/posts/PostDetailScreen.tsx` (1,290 LOC) | 10+ direct supabase calls: likes, comments, post_reactions, saves, saved_locations, restaurants | Feature complexity landed inline; no service abstraction enforced |
| `features/messages/CreateGroupScreen.tsx` (338 LOC) | `supabase.from('follows').select()` | Convenience; users service not checked |
| `features/settings/EditProfileScreen.tsx` (336 LOC) | `supabase.from('users').upsert()` | Duplicates `lib/services/users.ts` logic |

**Preventative action:** `check:architecture` script (grep for supabase import outside `lib/`) + ESLint rule.

### God Components

Three screens have grown beyond maintainable size:

| File | LOC | Contains |
| --- | --- | --- |
| `features/messages/ConversationScreen.tsx` | 2,375 | Message rendering, input, reactions, forwarding, pinning, search, moderation, GIFs |
| `features/search/SearchScreen.tsx` | 1,893 | Query, typeahead, filters, 4 result tabs, discovery page, trending, staff picks |
| `features/posts/PostDetailScreen.tsx` | 1,290 | Post render, comments, reactions, moderation, sharing, location lookup |

Root cause: no file-size guardrail; every feature addition lands in the nearest existing screen.

### God Hook

`lib/hooks/useSearch.ts` — **1,126 lines** combining: search execution, cuisine expansion, location geocoding, FTS queries, autocomplete, bounding box queries, taste profile boosting, filter management, and 8 different RPC call types. Impossible to test or extend independently.

### Context Provider Chain

`app/_layout.tsx` nests 7 providers: `AuthProvider → PushRegistrar → DeepLinkHandler → PostsProvider → PostUploadProvider → SettingsProvider → AuthGateProvider → CreateLauncherProvider`. Each re-renders all children on state change. Cold start risk. Acceptable for now; measure re-render performance before splitting.

### Type Safety Debt

**220 instances of `as any`** across the codebase. Origin: Supabase client typing mismatches resolved with inline casts instead of typed wrapper functions. Key hotspots: `lib/services/users.ts` (14+), `lib/services/posts.ts` (multiple), `lib/analytics.ts` (line 102), `lib/contexts/AuthContext.tsx` (line 85). Fix: typed wrapper functions in each service file.

### Test Coverage

**0%** — zero test files (no `.test.ts`, `.spec.ts`). This is the highest long-term risk: changes cannot be verified without manual testing, regressions go undetected, and refactors are expensive.

### Mock Data Boundary Violation

`features/search/SearchScreen.tsx` imports `demoUsers`, `demoRestaurants`, `demoCurrentUser` directly — violates AGENTS.md rule. Should route through config-aware data source layer.

### Dead Code

- `lib/services/offlineCache.ts` — 36 lines, completely unused
- `EMOJI_STAGGER_MS` constant in `lib/animations.ts` — defined, never called

### Anti-Patterns Enumerated

1. Direct supabase in 3 feature screens (root cause: no ESLint rule)
2. `as any` pervasive — 220 instances (root cause: no `@typescript-eslint/no-explicit-any` rule)
3. God components — ConversationScreen, SearchScreen, PostDetailScreen (root cause: no file size guard)
4. God hook — useSearch 1,126 LOC (root cause: no hook size guidance)
5. Hardcoded CHIPS array in SearchScreen (root cause: should be in `lib/dataSources/`)
6. Premature memoization — `suggestedPeople` in FeedScreen memoizes constant demo data
7. Unused offlineCache.ts — dead module increasing bundle confusion
8. Direct demo data import in SearchScreen (root cause: no check:architecture)
9. Silent error handling — some try-catch blocks swallow errors without user feedback
10. 160 instances of useCallback/useMemo — many unjustified

### Duplicate Abstractions

- Avatar color calculation: `lib/utils/format.ts` + duplicated in screens
- Restaurant navigation: `lib/utils/restaurantNavigation.ts` + screen-local logic
- Location formatting: `geo.ts` `formatKm()` + scattered inline variants

---

## 3. Design System Audit

### 3a. Existing Token System Assessment

| File | Status | Gap |
| --- | --- | --- |
| `constants/Colors.ts` | ✓ Defined — 14 semantic tokens per mode | Not imported in features; hardcoded hex used instead |
| `constants/Spacing.ts` | ✓ Defined — 8-pt scale (4/8/12/16/20/24/32px) | Not imported in features; raw px values used instead |
| `constants/Typography.ts` | ✓ Defined — font sizes xs–3xl, weights, line heights | Not imported in features; hardcoded fontSize used instead |
| `lib/animations.ts` | ✓ Defined — spring configs, timing, press scales | PRESS_SCALE tokens used in buttons only; EMOJI_STAGGER_MS never used |

All four systems are architecturally correct. The adoption gap is the entire problem.

### 3b. Token Adoption Failures

- **74 hardcoded hex colors** in `features/` — each maps to an existing token:
  - `#FEE2E2` → `c.errorBg` (light) or `c.errorBg` dark (`#3D1A1A`)
  - `#fff` / `#ffffff` → `c.white` or `c.bg`
  - `#E24B4A` → `c.liked`
  - `rgba(0,0,0,0.28)` → `c.overlay`
- **1,000+ hardcoded spacing values** — all padding, margin, gap values are raw px
- **100+ hardcoded fontSize values** — 8+ different sizes per screen with no semantic label
- **34 inline icon button implementations** — each `{ width: 34, height: 34, borderRadius: 17 }` is hand-typed

### 3c. Missing Token Definitions

These tokens should exist but don't:

| Token Category | Gap | Impact |
| --- | --- | --- |
| Border radius | Magic numbers 6/8/10/12/14/17/18/20/999 in 100+ places | Every component uses different radii; no system |
| Elevation / shadows | No shadow system defined; each component invents its own | Inconsistent depth hierarchy |
| Interaction states | No pressed/focused/disabled color tokens | Components use opacity hacks instead |
| Semantic chip colors | 15+ chip variants use `c.surface` arbitrarily | No distinction between chip types/priorities |
| Vibe/recommendation colors | `imgColors` (warm/green/blue/pink/clay/sage) exist but no semantic "recommendation" or "vibe" layer | Discovery UX has no consistent visual vocabulary |
| Message action colors | `#3B82F6` (info), `#6B7280` (mute), `#EF4444` (delete), `#22C55E` (success) undefined as tokens | Dark mode fails silently; 4 colors have no system equivalent |

### 3d. Dark Mode Gaps

| Screen / Component | Issue |
| --- | --- |
| `features/auth/LoginScreen.tsx` | `backgroundColor: '#FEE2E2'` error box — hardcoded; fails dark mode |
| `features/auth/SignupScreen.tsx` | Same `#FEE2E2` error box — duplicated |
| `features/settings/ChangePasswordScreen.tsx` | Same `#FEE2E2` error box — triplicated |
| `features/auth/WelcomeScreen.tsx` | `backgroundColor: '#fff'` for Google button |
| `features/search/SearchScreen.tsx` | `rgba(0,0,0,0.28)` backdrop — hardcoded; should use `c.overlay` |
| `components/AuthPromptModal.tsx` | `rgba(0,0,0,0.3)` backdrop — hardcoded |
| `features/messages/ConversationScreen.tsx` | `#3B82F6`, `#6B7280`, `#EF4444`, `#22C55E` — no dark equivalents |

These are invisible in light mode development and only surface as regressions in dark mode on-device. Root cause: no `check:darkmode` script.

### 3e. Component Duplication

| Pattern | Count | Correct Component |
| --- | --- | --- |
| Empty state implementations | 5 | `components/ui/EmptyState.tsx` (exists, bypassed 4 times) |
| Chip / pill variants | 15+ | No `<Chip>` primitive exists |
| Icon button (34×34 circle) | 34 | No `<IconButton>` primitive exists |
| Secondary button styles | 4+ | Only `PrimaryButton` exists; secondary patterns are inline |
| Error message boxes | 3 | No `<ErrorMessage>` component exists |

### 3f. Animation Gaps

- **Press scale on list rows:** SPRING_SNAPPY and PRESS_SCALE_ICON are defined in `lib/animations.ts`. Zero list items use them — only `PrimaryButton` and `TabBarPostButton` do.
- **EMOJI_STAGGER_MS:** Defined (`35ms` stagger constant). Never implemented. Dead animation investment.
- **Empty state entrance:** Appears instantly. Should fade-in or scale.
- **Modal backdrop:** No transition; appears instantly.

### 3g. Design System Drift Prevention

No automated enforcement exists. Current state:

- No `check:tokens` script to block new hardcoded hex in CI
- No `check:darkmode` script to catch literal `#fff` / `white` in features
- No ESLint rule enforcing token imports
- No lint rule blocking new instances of the patterns above

Without enforcement, every new screen adds more hardcoded values. The gap grows each sprint.

---

## 4. Navigation UX Audit

- **Tab bar:** 5 tabs (Feed, Search, Post CTA, Places, Profile); bottom-positioned — correct thumb ergonomics ✓
- **Navigation params inconsistency:** Mixed naming — some routes use underscore params, others camelCase. Standardise to camelCase.
- **Two location map screens:** `/location/[placeId]` and `/location/map` — relationship and ownership unclear. Needs resolution.
- **Auth gate:** `requireAuth()` / `useAuthGate()` called manually in 40+ callbacks across screens. Should be route-level protection or a higher-order component.
- **Deep linking:** `DeepLinkHandler` in `app/_layout.tsx` exists. Coverage of which routes are deep-linkable not verified.
- **Back navigation:** Deep flows (restaurant → post → user) have no breadcrumb trail. HIG recommends back labels showing destination.
- **Tab switching:** No visual transition between tabs — acceptable default; animated would feel more premium.
- **Modal vs push:** Filter sheets use modal (correct for iOS); consistent with HIG ✓.

---

## 5. Accessibility Audit

| Area | Finding | Severity |
| --- | --- | --- |
| Touch targets | Icon buttons render at 34×34px — below HIG 44pt minimum | Critical |
| Reduced motion | Reanimated used throughout; no `useReducedMotion` hook wrapping animations | High |
| Screen reader labels | No `accessibilityLabel` audit performed; icon-only buttons have no labels | High |
| Contrast | `text2` (`#6B6B66` on `#FAFAF8`) and `text3` (`#A8A8A2`) — WCAG AA unverified | Medium |
| Minimum font size | `fontSize: 10` (xs token) used in chips — Apple HIG recommends minimum 11pt | Medium |
| Rating stars | RatingDisplay component — screen reader affordance unknown | Medium |
| Chip / pill items | Tap targets likely below 44pt given compact chip styling | High |

No intentional accessibility work is visible in the codebase. This is a pre-beta requirement for App Store approval and user trust.

---

## 6. Performance Audit

- **Hermes + New Architecture:** Enabled in `app.config.js` — positive baseline ✓
- **Bundle size:** All 26 dependencies justified; no bloat detected ✓
- **Provider nesting:** 7 providers in `_layout.tsx` — each renders synchronously on cold start. No profiling data exists. This is the primary suspected cold-start risk.
- **Premature memoization:** `suggestedPeople` in FeedScreen memoized despite being constant demo data (never changes, has no reactive dependency). 160 total `useCallback`/`useMemo` instances; not all justified.
- **Dead module:** `offlineCache.ts` (36 LOC) imported nowhere — adds bundle confusion.
- **FlatList usage:** Appropriate throughout feed and search. No virtualization issues noted.
- **Scroll performance:** No profiling data. Cannot confirm 60/120Hz scroll performance.
- **Cold start measurement:** No baseline recorded. 7-provider chain should be profiled before beta.

---

## 7. Media + Network Audit

- **Image compression:** `react-native-compressor` in dependencies and use ✓
- **Image caching:** `expo-image` (aggressive disk+memory cache) vs legacy `Image` component — which is actually used is not confirmed. High impact on feed scroll performance.
- **Upload failure:** No retry logic or error state visible to user. Silent failure — user has no recovery path when upload fails on slow network.
- **Progressive loading:** `ActivityIndicator` used throughout. No skeleton loading. Sudden content appearance on slow networks degrades perceived performance.
- **Slow network states:** No graceful degradation documented or implemented. No stale-data indicators.
- **CDN / egress:** Storage costs monitored per `operations/COSTS.md` ✓. No progressive image delivery strategy.

---

## 8. Copywriting Compliance Audit

`design/UX_Copywriting_Guide.md` is comprehensive and present. Key rules (from memory):

- British English spellings
- "Tap" not "Click"
- "Create account" not "Sign up"
- Full caps for status labels only
- Human, conversational, concise tone

**Per-screen compliance: NOT VERIFIED.** This requires a screen-by-screen audit.

Highest risk areas:
- Auth screens (welcome, login, signup) — first user impression; often has form-like copy
- Empty states — risk of "Nothing here yet" dead-app language instead of encouraging exploration
- Error messages — risk of technical/robotic copy
- Settings screens — risk of dense instructional prose
- Post creation flow — placeholder copy risk of generic "Add caption" instead of expressive prompts

---

## 9. HIG / Material3 Compliance Audit

| Principle | Status | Detail |
| --- | --- | --- |
| Touch targets ≥ 44pt | Failing | Icon buttons at 34×34px throughout |
| Thumb reachability | Passing | Tab bar bottom-positioned; filter sheets bottom-anchored |
| Gesture harmony | Partially passing | Bottom sheet gestures present; swipe-to-dismiss on modals unverified |
| Minimum readable font size | At risk | `fontSize: 10` (xs token) used in chip labels |
| Predictable navigation | Passing | Expo Router; consistent push/modal patterns |
| Low cognitive load | Failing | SearchScreen renders 4 tabs + filters + discovery in one view |
| Interaction feedback | Partially failing | Press scale on buttons ✓; list items use opacity only, no scale |
| Typography hierarchy | Partially failing | 8+ font size variants per screen with no semantic naming |

---

## 10. Responsive Layout + Platform Audit

- **iPad/tablet:** No layout strategy detected. Feature screens assume a phone viewport. Hardcoded pixel widths likely throughout.
- **SafeAreaView:** Usage not audited. Dynamic Island (iPhone 14 Pro+) and notch variants may not be handled uniformly.
- **Foldable:** Not considered. No adaptive layout token layer.
- **Platform divergence:** No intentional iOS-only / Android-only divergence detected in this audit scope — good for maintenance.
- **Responsive tokens:** No `maxWidth` container or responsive layout token system defined.

iPad support is not a current product priority but architectural decisions made now (hardcoded widths) will make it expensive later.

---

## 11. Trust + Safety Audit

- **RLS:** In place across all user-data tables. Recursion bug fixed in migration `20240214` ✓
- **Moderation:** `moderate-content` Edge Function exists. Full moderation queue/reporting platform deferred to beta (BACKLOG.md B-183, B-184) — appropriate for current stage.
- **Rate limiting:** Supabase GoTrue applies default rate limits to auth endpoints. Specific config not verified. Brute-force on signup/login is a risk if defaults are too permissive.
- **Upload safety:** `process-post-media` Edge Function exists. Malicious content detection policy not audited in depth.
- **Trust scoring:** Deferred to beta (BACKLOG.md B-183–190).
- **Fake engagement:** No anti-spam for likes/saves. Appropriate for current scale; needs attention at beta.

---

## 12. Analytics + Event Governance Audit

**Strengths:**

- Consistent `snake_case` event naming with semantic prefixes (`post_*`, `search_*`, `place_*`, `user_*`, `feed_*`)
- Metadata sanitization: 70-key allowlist + sensitive data regex blocking
- 15-second cooldown per event prevents storms
- Silent failure — analytics never crashes the app
- Strong funnel coverage: search → result_click → view → save → revisit

**Gaps:**

| Gap | Risk |
| --- | --- |
| No `event_version` field | Historical queries break as event shapes evolve |
| No percentage sampling strategy | At scale, feed_view events without sampling could spike DB costs |
| No TTL / retention policy | analytics_events table will grow unbounded |
| Missing: `comment_view`, `feed_error`, `search_error` | Funnel blind spots |
| Analytics_events table schema and indexing not reviewed | Performance unknown at scale |

---

## 13. Operations Audit

**All AGENTS.md required checks present and CI-gated:**

- `check:hygiene` (composite — 11 checks) ✓
- `check:docs` ✓
- `check:platform` ✓
- `npm run typecheck` ✓
- `check:release` (composite — 10 checks) ✓
- `npm run lint` ✓ locally; **not gated in CI PR workflow** — gap

**Missing check scripts** (required by operating command):

- `check:architecture` — god component + service boundary detection
- `check:design` — composite of tokens + darkmode
- `check:tokens` — grep hardcoded hex/spacing in features/
- `check:darkmode` — grep literal whites/hardcoded light-only colors
- `check:a11y` — grep missing accessibilityLabel on interactive elements
- `check:performance` — file size + memoization pattern
- `check:automation` — LESSONS.md currency
- `validate` — composite: typecheck + lint + check:tokens
- `validate:full` — validate + release + architecture + design

**CI/CD:** 16 checks; scheduled crons (daily/weekly/monthly/quarterly); artifact upload. Strong foundation ✓.

**Feature flags:** 32 flags, well-structured with owner/state/reviewAt metadata. No emergency DB-override: code-only flags cannot be disabled without a release — production incident risk.

**Documentation:** All 50+ expected docs present. Comprehensive governance. Authority order enforced ✓.

**Dependencies:** 0 vulnerabilities. All 26 direct dependencies justified. React Native 0.81.5 is bleeding-edge (high upgrade churn risk).

---

## 14. Startup Cost Efficiency Audit

| Service | Cost Driver | Status | Risk |
| --- | --- | --- | --- |
| Google Places / Maps | API calls per search | TTL caching (30-day) in place; B-004 restrictions open | Medium — quota without IP restrictions |
| Supabase | DB volume, Edge Function calls, Storage | Free tier sufficient for beta | Low |
| Expo Push | Notification volume | Free at beta scale | Low |
| EAS Build | Build minutes | Free tier may be exceeded at production volume | Medium |
| Giphy | GIF search API calls | Key in env; actual usage not verified | Low — may be cuttable |
| AI | Runtime inference | No runtime AI dependency today | Low |
| npm packages | 0 paid | All open-source | ✓ |
| Check scripts (new) | Bash/grep | All proposed check scripts use free tooling | ✓ |

**Operational overhead:** 42 check scripts is significant for a 1–2 person team. New composite commands (`validate`, `validate:full`) reduce this to 2 daily commands. The investment compounds: each check prevents a class of bugs permanently.

---

## 15. LESSONS.md Currency + Token Efficiency Audit

- `docs/LESSONS.md`: 4 lessons; all valid and current ✓
- `AGENTS.md`: 155 lines; well-structured; engineering rules need update based on this audit
- Combined cold-start context for AI agents (AGENTS.md + LESSONS.md): ~300 lines — token-efficient ✓
- `REPO_MAP.md` + `BACKLOG.md` excerpt: ~500 additional lines — reasonable
- **Total agent context load:** ~800 lines at cold start; efficient for a codebase this size

No duplicated guidance detected across AGENTS.md / LESSONS.md. Operations/ folder has 22 docs — some potential overlap but not confirmed without full read.

8 new lessons added to `docs/LESSONS.md` from this audit. See that file.

---

## 16. Product UX Direction Audit

Target feel per operating command: **"Instagram + Xiaohongshu + TikTok for trusted food discovery — social food storytelling, taste identity, expressive recommendations, vibe-first exploration"**

NOT: Yelp, Google Reviews, TripAdvisor, enterprise/admin tooling.

| Screen | Current Energy | Target Energy | Drift? |
| --- | --- | --- | --- |
| Feed | Visual post cards with media carousels, tabs (Following/Discover) | Social/visual | Mostly aligned ✓ |
| Post card | Media + creator info + location + ratings summary | Storytelling | Partially — ratings summary reads like review metadata |
| Search | 4-tab results + filter sheet + query box dominant | Vibe-driven discovery | At risk — query-first feels directory-like |
| Search chips | Cuisine chips on discovery page | Curated curation | Good — chips are more curated than a search box |
| Places | Restaurant directory view | Hyperlocal discovery | At risk — could drift toward Google Maps clone feel |
| Profile | Tab layout with posts, saves, visited | Taste identity | Neutral — needs more visual taste graph expression |
| Empty states | Unknown (not verified per-screen) | Encouraging, identity-reinforcing | Unverified — high risk of "nothing here yet" copy |
| Onboarding | Multi-step signup with profile setup | Taste identity communication | Unknown — sign-up-profile screen not read |
| Post creation | Multi-step wizard (3 steps) | Expressive, low-friction | Unknown — needs UX-flow audit |

**Key risk:** The places/search experience could drift toward directory-like if not actively shaped toward vibe-first discovery. The post card ratings summary should feel like curated taste, not star ratings.

---

## 17. Activation + Onboarding Quality Audit

**Blind spot warning:** This section is partially speculative — the signup-profile screen and welcome screen were read at a high level only.

| Metric | Finding | Status |
| --- | --- | --- |
| Time to first value | Auth → onboarding → feed — unknown step count | Unverified |
| Social auth available | Google sign-in exists in WelcomeScreen | ✓ Good — reduces friction |
| Password fields | Email + password at signup; 8-char requirement | Password only; social auth preferred |
| Profile setup | SignupProfileScreen exists — preferences collected | Good if immediately used |
| Cold start content | New user with 0 follows sees suggested people list | At risk — list format, not visual/social |
| First post CTA | TabBarPostButton exists prominently | ✓ Good |
| Emotional payoff speed | No data — unverified | Unverified |

The `suggestedPeople` experience for new users (0 follows) currently renders as a list of usernames + follower counts. This is the first social impression and it should feel more like "people with your taste" than a directory.

---

## 18. Bug Prevention Automation Plan

For each bug class discovered, a preventative guardrail is planned:

| Bug Class | Instances Found | Preventative Action | Priority |
| --- | --- | --- | --- |
| Hardcoded hex colors | 74 | `check:tokens` script (grep `#[0-9a-fA-F]` in features/) | P0 |
| Dark mode regressions | Multiple screens | `check:darkmode` script (grep `#fff`, `white`, `#FEE2E2` in features/) | P0 |
| Direct supabase in screens | 3 screens | ESLint rule: no supabase import outside `lib/`; `check:architecture` | P0 |
| God components | 3 (>1,000 LOC each) | `check:architecture` script: fail if features/ file >600 LOC | P0 |
| `as any` proliferation | 220 instances | ESLint: `@typescript-eslint/no-explicit-any` in features/ + lib/services/ | P0 |
| Password validation inconsistency | 1 (8-char vs 6-char) | `lib/utils/validation.ts` centralised validators | P1 |
| Missing accessibilityLabel | Unknown count | `check:a11y` script (grep TouchableOpacity without accessibilityLabel) | P1 |
| LESSONS.md staleness | N/A | Git commit hook + `check:automation` CI step | P1 |
| Dead animation tokens | 1 (EMOJI_STAGGER_MS) | AGENTS.md rule: implement tokens in same PR or don't merge | P0 |
| Premature memoization | 160+ instances | `check:performance` script (file size + useMemo pattern scan) | P2 |

**Key principle:** Implement the preventative check before fixing existing instances. The check prevents recurrence permanently. Fixing 74 hardcoded colors without `check:tokens` means the 75th will appear next sprint.

---

## 19. AGENTS.md Update Summary

AGENTS.md updated with the following additions (see `AGENTS.md` for exact text):

**Engineering Rules added (6):**

1. Token enforcement (Colors, Spacing, Typography — never hardcode)
2. Touch target minimum (44×44pt via `<IconButton>` primitive)
3. Service boundary (no supabase import outside lib/)
4. Type safety (no `as any` — use typed wrappers)
5. God component prevention (screens <400 LOC; hooks <200 LOC)
6. Animation token adoption (implement in same PR or don't define)

**Required Checks added (3):**

- `check:tokens` — run when touching features/ styling
- `check:darkmode` — run when adding any color or background
- `check:a11y` — run when adding/modifying interactive elements

**AI behavior rules added (5):**

1. Check LESSONS.md before starting any task
2. Use parallel Explore agents (up to 3) for broad audits
3. When fixing a bug: identify root cause, similar risks, implement preventative check
4. After fixing a bug class: update LESSONS.md, verify AGENTS.md rule coverage
5. Minimise token usage: think once, do not re-read files in context

---

## 20. Recommended Execution Order

Follow P0 → P1 → P2 → P3 from `backlog_new.md`. Within P0, sequence:

1. **AGENTS.md update (AGENTS-001)** — before writing any code, upgrade the rules AI agents follow
2. **ESLint rules (ARCH-014, ARCH-015)** — enforcement before fixes; otherwise fixes don't stick
3. **Check scripts (AUTO-001, AUTO-003, AUTO-004)** — catch future instances before fixing current ones
4. **Service boundary fixes (ARCH-001–003)** — highest regression risk, clean first
5. **Dark mode fixes (DS-002, DS-005)** — visible to all users immediately
6. **Token sweep (DS-001)** — highest volume of changes; do after checks are in CI
7. **Component extraction (DS-003, DS-004)** — DRY before building new features
8. **CI lint gate (CI-001)** — prevents drift resuming

**Rationale:** Preventative automation first, then fixes. Each check script prevents the fixed class from returning. Without automation, manual fixes are temporary.

---

## Blind Spots + Unknowns

The following were identified as unverified during this audit. Do not assume correctness:

- **PostDetailScreen:** 10+ direct supabase calls found. Full blast radius not mapped — more violations may exist in the 1,290 LOC not fully read.
- **ConversationScreen:** 2,375 LOC not fully read — additional concerns likely exist beyond those identified.
- **Image loading library:** expo-image vs legacy `Image` component — which is used is not confirmed. High performance impact.
- **Touch target sizes:** Not programmatically measured. 34px reported from visual code inspection; may vary.
- **UX copy compliance:** Not verified screen-by-screen. Audit needed.
- **Analytics event coverage:** Not all screens confirmed to emit `screen_view`. Coverage gaps unknown.
- **Supabase GoTrue rate limits:** Default config not confirmed. Auth brute-force risk unquantified.
- **Deep link coverage:** DeepLinkHandler present but which routes are registered is unknown.
- **Onboarding flow quality:** SignupProfileScreen and post-signup experience not fully read.
- **SafeAreaView consistency:** Notch/Dynamic Island handling not verified across all screens.

---

## Likely Future Failure Modes

1. **Design system fragmentation:** Without `check:tokens` enforcement, every new screen adds more hardcoded values. The 74 current instances become 200 by beta.
2. **God component gravity:** SearchScreen and ConversationScreen attract every new feature that "fits nearby." Without a size guard, they'll reach 3,000+ LOC.
3. **`as any` proliferation:** 220 instances grew from a convention of convenience. Without `@typescript-eslint/no-explicit-any`, it grows to 400 within a year.
4. **Dark mode regressions on every feature:** Every new screen written without `check:darkmode` will have hardcoded light colors. Each is invisible until dark mode user reports it.
5. **Analytics event drift:** Events will evolve but without `event_version`, no historical query can safely span event shape changes. Dashboards break silently.
6. **Provider cost surprises:** B-004 (IP/domain restrictions) on Google Places still open. A quota spike without alerts could generate unexpected costs before restrictions are in place.
7. **React Native 0.81.5 upgrade churn:** Bleeding-edge RN has a fast deprecation cycle. Without a structured upgrade plan, major version bumps cause extended instability.
8. **LESSONS.md becoming stale:** Without the git hook enforcement, learnings stop being recorded after the first month. Future agents repeat solved problems.
