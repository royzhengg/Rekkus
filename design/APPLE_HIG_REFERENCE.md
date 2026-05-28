# Apple HIG Reference For Rekkus

## Purpose And Source Policy

Apple's [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/) are the authoritative Apple-platform design source. This document is Rekkus's implementation index: it paraphrases guidance, maps it to product surfaces, and links execution work. It must not mirror Apple's prose or downloaded documentation data.

- Last reviewed: `2026-05-26`
- Source coverage: the official Apple HIG navigator data exposed 170 navigable nodes, including the root module, section collections, nested component collections, and article pages.
- Platform position: iPhone is the primary Apple quality target; equivalent interaction quality must remain available on Android.

## Immediate Rekkus Principles

- Tabs identify destinations: Feed, Search, Saved, and Profile. Creating a post is a floating action, not a tab destination.
- Ask for protected capabilities only after intent: location, photos, camera, microphone, and notifications are contextual requests.
- Interactive controls provide an effective 44pt target, useful accessibility semantics, system text scaling, dark-mode contrast, and reduced-motion behavior.
- Apply system-familiar behavior through Rekkus primitives and feature ownership; do not make Android imitate Apple-only visual APIs.
- B-531 tests a disabled-by-default iOS tab material backdrop only in development/staging; Reduce Transparency, Android, beta, and production retain opaque navigation until physical-device acceptance exists.
- Keep the product dish-first: images, dishes, saves, collections, and local food decisions lead over generic directory or social chrome.

## Status Key

| Status | Meaning |
| --- | --- |
| Apply now | Relevant to shipped Rekkus surfaces or required quality guardrails. |
| Later | Relevant to an intentional future capability or deferred platform expansion. |
| Not current | No present Rekkus product surface; revisit only if scope changes. |

Backlog links: [B-524](../BACKLOG.md#b-524) permissions, [B-525](../BACKLOG.md#b-525) navigation/create, [B-526](../BACKLOG.md#b-526) accessibility, [B-527](../BACKLOG.md#b-527) adaptive layout, [B-528](../BACKLOG.md#b-528) forms/modality, [B-529](../BACKLOG.md#b-529) motion/media, [B-530](../BACKLOG.md#b-530) acceptance evidence, and [B-531](../BACKLOG.md#b-531) gated iOS visuals.

## Complete HIG Inventory

All links below point to Apple's live HIG pages. Collection pages are included because they define the official navigation grouping.

### Getting Started

| Topic | Apple source | Status | Rekkus area / work |
| --- | --- | --- | --- |
| Getting started | [Source](https://developer.apple.com/design/human-interface-guidelines/getting-started) | Apply now | Design baseline; B-530 |
| Designing for iOS | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-ios) | Apply now | iPhone interaction/layout; B-527, B-530 |
| Designing for iPadOS | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-ipados) | Later | Existing B-501/B-502 tablet work |
| Designing for macOS | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-macos) | Not current | No Mac app |
| Designing for tvOS | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-tvos) | Not current | No TV app |
| Designing for visionOS | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-visionos) | Not current | No spatial app |
| Designing for watchOS | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-watchos) | Not current | No watch app |
| Designing for games | [Source](https://developer.apple.com/design/human-interface-guidelines/designing-for-games) | Not current | Not a game |

### Foundations

| Topic | Apple source | Status | Rekkus area / work |
| --- | --- | --- | --- |
| Foundations | [Source](https://developer.apple.com/design/human-interface-guidelines/foundations) | Apply now | Design docs and acceptance; B-530 |
| Accessibility | [Source](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Apply now | Shared UI and flows; B-526/B-530 |
| App icons | [Source](https://developer.apple.com/design/human-interface-guidelines/app-icons) | Later | Release branding review |
| Branding | [Source](https://developer.apple.com/design/human-interface-guidelines/branding) | Apply now | Rekkus identity and third-party marks; B-530 |
| Color | [Source](https://developer.apple.com/design/human-interface-guidelines/color) | Apply now | Tokens/contrast; B-526/B-527 |
| Dark Mode | [Source](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Apply now | Theme checks; B-527/B-530 |
| Icons | [Source](https://developer.apple.com/design/human-interface-guidelines/icons) | Apply now | Shared icon library; B-526 |
| Images | [Source](https://developer.apple.com/design/human-interface-guidelines/images) | Apply now | Food media and cached imagery; B-529 |
| Immersive experiences | [Source](https://developer.apple.com/design/human-interface-guidelines/immersive-experiences) | Not current | No immersive surface |
| Inclusion | [Source](https://developer.apple.com/design/human-interface-guidelines/inclusion) | Apply now | Copy/content representation; B-530 |
| Layout | [Source](https://developer.apple.com/design/human-interface-guidelines/layout) | Apply now | iPhone layouts and targets; B-527 |
| Materials | [Source](https://developer.apple.com/design/human-interface-guidelines/materials) | Later | Disabled staging-only tab material spike with opaque Reduce Transparency fallback; B-531 |
| Motion | [Source](https://developer.apple.com/design/human-interface-guidelines/motion) | Apply now | Reduce Motion; B-529 |
| Privacy | [Source](https://developer.apple.com/design/human-interface-guidelines/privacy) | Apply now | Contextual permissions; B-524/B-528 |
| Right to left | [Source](https://developer.apple.com/design/human-interface-guidelines/right-to-left) | Later | Localization expansion |
| SF Symbols | [Source](https://developer.apple.com/design/human-interface-guidelines/sf-symbols) | Later | iOS-native visual review; B-531 |
| Spatial layout | [Source](https://developer.apple.com/design/human-interface-guidelines/spatial-layout) | Not current | No spatial app |
| Typography | [Source](https://developer.apple.com/design/human-interface-guidelines/typography) | Apply now | Dynamic Type/legibility; B-527 |
| Writing | [Source](https://developer.apple.com/design/human-interface-guidelines/writing) | Apply now | Copy and permission language; B-528 |

### Patterns

| Topic | Apple source | Status | Rekkus area / work |
| --- | --- | --- | --- |
| Patterns | [Source](https://developer.apple.com/design/human-interface-guidelines/patterns) | Apply now | Interaction baseline; B-530 |
| Charting data | [Source](https://developer.apple.com/design/human-interface-guidelines/charting-data) | Not current | No user chart surface |
| Collaboration and sharing | [Source](https://developer.apple.com/design/human-interface-guidelines/collaboration-and-sharing) | Apply now | Post/place sharing and messages; B-529 |
| Drag and drop | [Source](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop) | Later | Media ordering/tablet affordances |
| Entering data | [Source](https://developer.apple.com/design/human-interface-guidelines/entering-data) | Apply now | Auth/create/search fields; B-528 |
| Feedback | [Source](https://developer.apple.com/design/human-interface-guidelines/feedback) | Apply now | Errors/loading/haptics; B-528/B-529 |
| File management | [Source](https://developer.apple.com/design/human-interface-guidelines/file-management) | Not current | No general file manager |
| Going full screen | [Source](https://developer.apple.com/design/human-interface-guidelines/going-full-screen) | Later | Media viewing review; B-529 |
| Launching | [Source](https://developer.apple.com/design/human-interface-guidelines/launching) | Apply now | Startup/onboarding; B-530 |
| Live-viewing apps | [Source](https://developer.apple.com/design/human-interface-guidelines/live-viewing-apps) | Not current | No broadcast surface |
| Loading | [Source](https://developer.apple.com/design/human-interface-guidelines/loading) | Apply now | Canonical loading surfaces; B-530 |
| Managing accounts | [Source](https://developer.apple.com/design/human-interface-guidelines/managing-accounts) | Apply now | Auth/settings; B-528 |
| Managing notifications | [Source](https://developer.apple.com/design/human-interface-guidelines/managing-notifications) | Apply now | Permission timing/settings; B-528 |
| Modality | [Source](https://developer.apple.com/design/human-interface-guidelines/modality) | Apply now | `RekkusActionSheet` and recovery; B-528 |
| Multitasking | [Source](https://developer.apple.com/design/human-interface-guidelines/multitasking) | Later | Existing B-501/B-502 tablet work |
| Offering help | [Source](https://developer.apple.com/design/human-interface-guidelines/offering-help) | Apply now | Empty/onboarding/recovery copy; B-528 |
| Onboarding | [Source](https://developer.apple.com/design/human-interface-guidelines/onboarding) | Apply now | Auth/onboarding; B-528 |
| Playing audio | [Source](https://developer.apple.com/design/human-interface-guidelines/playing-audio) | Later | Voice/media expansion; B-529 |
| Playing haptics | [Source](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) | Apply now | Supplementary feedback; B-529 |
| Playing video | [Source](https://developer.apple.com/design/human-interface-guidelines/playing-video) | Apply now | Post/message media; B-529 |
| Printing | [Source](https://developer.apple.com/design/human-interface-guidelines/printing) | Not current | No print feature |
| Ratings and reviews | [Source](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews) | Apply now | Rekkus Picks/create; B-530 |
| Searching | [Source](https://developer.apple.com/design/human-interface-guidelines/searching) | Apply now | Search/discovery; B-524/B-527 |
| Settings | [Source](https://developer.apple.com/design/human-interface-guidelines/settings) | Apply now | Account/privacy settings; B-528 |
| Undo and redo | [Source](https://developer.apple.com/design/human-interface-guidelines/undo-and-redo) | Apply now | Destructive/edit recovery review; B-528 |
| Workouts | [Source](https://developer.apple.com/design/human-interface-guidelines/workouts) | Not current | No fitness feature |

### Components

| Topic | Apple source | Status | Rekkus area / work |
| --- | --- | --- | --- |
| Components | [Source](https://developer.apple.com/design/human-interface-guidelines/components) | Apply now | UI primitives; B-526/B-528 |
| Content | [Source](https://developer.apple.com/design/human-interface-guidelines/content) | Apply now | Content surfaces; B-529 |
| Charts | [Source](https://developer.apple.com/design/human-interface-guidelines/charts) | Not current | No charts |
| Image views | [Source](https://developer.apple.com/design/human-interface-guidelines/image-views) | Apply now | Food media; B-529 |
| Text views | [Source](https://developer.apple.com/design/human-interface-guidelines/text-views) | Apply now | Review/messages; B-528 |
| Web views | [Source](https://developer.apple.com/design/human-interface-guidelines/web-views) | Later | External content review |
| Layout and organization | [Source](https://developer.apple.com/design/human-interface-guidelines/layout-and-organization) | Apply now | Screen composition; B-527 |
| Boxes | [Source](https://developer.apple.com/design/human-interface-guidelines/boxes) | Not current | Desktop-specific presentation |
| Collections | [Source](https://developer.apple.com/design/human-interface-guidelines/collections) | Apply now | Feed/saved grids; B-527 |
| Column views | [Source](https://developer.apple.com/design/human-interface-guidelines/column-views) | Later | Tablet work |
| Disclosure controls | [Source](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls) | Apply now | Optional details/settings; B-528 |
| Labels | [Source](https://developer.apple.com/design/human-interface-guidelines/labels) | Apply now | Forms/metadata; B-527/B-528 |
| Lists and tables | [Source](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables) | Apply now | Search/saved/settings; B-526 |
| Lockups | [Source](https://developer.apple.com/design/human-interface-guidelines/lockups) | Not current | TV presentation |
| Outline views | [Source](https://developer.apple.com/design/human-interface-guidelines/outline-views) | Not current | No hierarchical desktop view |
| Split views | [Source](https://developer.apple.com/design/human-interface-guidelines/split-views) | Later | Tablet work |
| Tab views | [Source](https://developer.apple.com/design/human-interface-guidelines/tab-views) | Apply now | Internal content tabs; B-526 |
| Menus and actions | [Source](https://developer.apple.com/design/human-interface-guidelines/menus-and-actions) | Apply now | Actions/sheets; B-528 |
| Activity views | [Source](https://developer.apple.com/design/human-interface-guidelines/activity-views) | Apply now | Sharing; B-529 |
| Buttons | [Source](https://developer.apple.com/design/human-interface-guidelines/buttons) | Apply now | Canonical controls; B-526 |
| Context menus | [Source](https://developer.apple.com/design/human-interface-guidelines/context-menus) | Later | Content action review |
| Dock menus | [Source](https://developer.apple.com/design/human-interface-guidelines/dock-menus) | Not current | No Mac app |
| Edit menus | [Source](https://developer.apple.com/design/human-interface-guidelines/edit-menus) | Later | Text edit review |
| Home Screen quick actions | [Source](https://developer.apple.com/design/human-interface-guidelines/home-screen-quick-actions) | Later | App shortcut work |
| Menus | [Source](https://developer.apple.com/design/human-interface-guidelines/menus) | Apply now | Action choices; B-528 |
| Ornaments | [Source](https://developer.apple.com/design/human-interface-guidelines/ornaments) | Not current | Spatial app concept |
| Pop-up buttons | [Source](https://developer.apple.com/design/human-interface-guidelines/pop-up-buttons) | Not current | Desktop component |
| Pull-down buttons | [Source](https://developer.apple.com/design/human-interface-guidelines/pull-down-buttons) | Later | Action selection review |
| The menu bar | [Source](https://developer.apple.com/design/human-interface-guidelines/the-menu-bar) | Not current | No Mac app |
| Toolbars | [Source](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Apply now | Contextual actions; B-525/B-526 |
| Navigation and search | [Source](https://developer.apple.com/design/human-interface-guidelines/navigation-and-search) | Apply now | Root nav/search; B-524/B-525 |
| Path controls | [Source](https://developer.apple.com/design/human-interface-guidelines/path-controls) | Not current | No filesystem path UI |
| Search fields | [Source](https://developer.apple.com/design/human-interface-guidelines/search-fields) | Apply now | Search entry; B-527/B-528 |
| Sidebars | [Source](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Later | Tablet work |
| Tab bars | [Source](https://developer.apple.com/design/human-interface-guidelines/tab-bars) | Apply now | Destination-only nav; B-525 |
| Token fields | [Source](https://developer.apple.com/design/human-interface-guidelines/token-fields) | Later | Search filter review |
| Presentation | [Source](https://developer.apple.com/design/human-interface-guidelines/presentation) | Apply now | Sheets/alerts; B-528 |
| Action sheets | [Source](https://developer.apple.com/design/human-interface-guidelines/action-sheets) | Apply now | `RekkusActionSheet`; B-528 |
| Alerts | [Source](https://developer.apple.com/design/human-interface-guidelines/alerts) | Apply now | Actionable failures only; B-528 |
| Page controls | [Source](https://developer.apple.com/design/human-interface-guidelines/page-controls) | Apply now | Media carousel review; B-529 |
| Panels | [Source](https://developer.apple.com/design/human-interface-guidelines/panels) | Not current | Desktop component |
| Popovers | [Source](https://developer.apple.com/design/human-interface-guidelines/popovers) | Later | Tablet presentation |
| Scroll views | [Source](https://developer.apple.com/design/human-interface-guidelines/scroll-views) | Apply now | Feeds/details; B-527 |
| Sheets | [Source](https://developer.apple.com/design/human-interface-guidelines/sheets) | Apply now | Choice/recovery flows; B-528 |
| Windows | [Source](https://developer.apple.com/design/human-interface-guidelines/windows) | Later | Tablet/multitasking |
| Selection and input | [Source](https://developer.apple.com/design/human-interface-guidelines/selection-and-input) | Apply now | Forms/filters; B-528 |
| Color wells | [Source](https://developer.apple.com/design/human-interface-guidelines/color-wells) | Not current | No color picking |
| Combo boxes | [Source](https://developer.apple.com/design/human-interface-guidelines/combo-boxes) | Not current | Desktop component |
| Digit entry views | [Source](https://developer.apple.com/design/human-interface-guidelines/digit-entry-views) | Later | Verification if added |
| Image wells | [Source](https://developer.apple.com/design/human-interface-guidelines/image-wells) | Apply now | Media picker review; B-529 |
| Pickers | [Source](https://developer.apple.com/design/human-interface-guidelines/pickers) | Apply now | Cuisine/settings selection; B-528 |
| Segmented controls | [Source](https://developer.apple.com/design/human-interface-guidelines/segmented-controls) | Apply now | Result/feed tabs; B-526 |
| Sliders | [Source](https://developer.apple.com/design/human-interface-guidelines/sliders) | Not current | No slider |
| Steppers | [Source](https://developer.apple.com/design/human-interface-guidelines/steppers) | Not current | No stepper |
| Text fields | [Source](https://developer.apple.com/design/human-interface-guidelines/text-fields) | Apply now | Forms/search; B-528 |
| Toggles | [Source](https://developer.apple.com/design/human-interface-guidelines/toggles) | Apply now | Settings/filters; B-526/B-528 |
| Virtual keyboards | [Source](https://developer.apple.com/design/human-interface-guidelines/virtual-keyboards) | Apply now | Text input keyboard behavior; B-528 |
| Status | [Source](https://developer.apple.com/design/human-interface-guidelines/status) | Apply now | Loading/feedback; B-529 |
| Activity rings | [Source](https://developer.apple.com/design/human-interface-guidelines/activity-rings) | Not current | No fitness feature |
| Gauges | [Source](https://developer.apple.com/design/human-interface-guidelines/gauges) | Not current | No gauges |
| Progress indicators | [Source](https://developer.apple.com/design/human-interface-guidelines/progress-indicators) | Apply now | Upload/loading; B-529 |
| Rating indicators | [Source](https://developer.apple.com/design/human-interface-guidelines/rating-indicators) | Apply now | Rekkus Picks review; B-530 |
| System experiences | [Source](https://developer.apple.com/design/human-interface-guidelines/system-experiences) | Later | Platform integration review |
| App Shortcuts | [Source](https://developer.apple.com/design/human-interface-guidelines/app-shortcuts) | Later | Future shortcuts |
| Complications | [Source](https://developer.apple.com/design/human-interface-guidelines/complications) | Not current | No watch app |
| Controls | [Source](https://developer.apple.com/design/human-interface-guidelines/controls) | Later | Future widgets/control center |
| Live Activities | [Source](https://developer.apple.com/design/human-interface-guidelines/live-activities) | Later | Future timely updates |
| Notifications | [Source](https://developer.apple.com/design/human-interface-guidelines/notifications) | Apply now | Alerts permission/content; B-528 |
| Status bars | [Source](https://developer.apple.com/design/human-interface-guidelines/status-bars) | Apply now | Screen presentation; B-527 |
| Top Shelf | [Source](https://developer.apple.com/design/human-interface-guidelines/top-shelf) | Not current | No TV app |
| Watch faces | [Source](https://developer.apple.com/design/human-interface-guidelines/watch-faces) | Not current | No watch app |
| Widgets | [Source](https://developer.apple.com/design/human-interface-guidelines/widgets) | Later | Future quick access |

### Inputs

| Topic | Apple source | Status | Rekkus area / work |
| --- | --- | --- | --- |
| Inputs | [Source](https://developer.apple.com/design/human-interface-guidelines/inputs) | Apply now | Touch/keyboard baseline; B-526/B-528 |
| Action button | [Source](https://developer.apple.com/design/human-interface-guidelines/action-button) | Not current | Hardware-specific |
| Apple Pencil and Scribble | [Source](https://developer.apple.com/design/human-interface-guidelines/apple-pencil-and-scribble) | Later | Tablet input |
| Camera Control | [Source](https://developer.apple.com/design/human-interface-guidelines/camera-control) | Later | Media capture review |
| Digital Crown | [Source](https://developer.apple.com/design/human-interface-guidelines/digital-crown) | Not current | No watch app |
| Eyes | [Source](https://developer.apple.com/design/human-interface-guidelines/eyes) | Not current | No spatial app |
| Focus and selection | [Source](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection) | Later | Keyboard/tablet support |
| Game controls | [Source](https://developer.apple.com/design/human-interface-guidelines/game-controls) | Not current | Not a game |
| Gestures | [Source](https://developer.apple.com/design/human-interface-guidelines/gestures) | Apply now | Alternatives and discoverability; B-526 |
| Gyroscope and accelerometer | [Source](https://developer.apple.com/design/human-interface-guidelines/gyro-and-accelerometer) | Not current | No motion input |
| Keyboards | [Source](https://developer.apple.com/design/human-interface-guidelines/keyboards) | Apply now | Forms/search; B-528 |
| Nearby interactions | [Source](https://developer.apple.com/design/human-interface-guidelines/nearby-interactions) | Not current | Location is not UWB proximity |
| Pointing devices | [Source](https://developer.apple.com/design/human-interface-guidelines/pointing-devices) | Later | Tablet support |
| Remotes | [Source](https://developer.apple.com/design/human-interface-guidelines/remotes) | Not current | No TV app |

### Technologies

| Topic | Apple source | Status | Rekkus area / work |
| --- | --- | --- | --- |
| Technologies | [Source](https://developer.apple.com/design/human-interface-guidelines/technologies) | Later | Capability review |
| AirPlay | [Source](https://developer.apple.com/design/human-interface-guidelines/airplay) | Not current | No playback casting |
| Always On | [Source](https://developer.apple.com/design/human-interface-guidelines/always-on) | Not current | No ambient surface |
| App Clips | [Source](https://developer.apple.com/design/human-interface-guidelines/app-clips) | Later | Acquisition experiment |
| Apple Pay | [Source](https://developer.apple.com/design/human-interface-guidelines/apple-pay) | Later | Monetization only |
| Augmented reality | [Source](https://developer.apple.com/design/human-interface-guidelines/augmented-reality) | Not current | No AR feature |
| CareKit | [Source](https://developer.apple.com/design/human-interface-guidelines/carekit) | Not current | No care feature |
| CarPlay | [Source](https://developer.apple.com/design/human-interface-guidelines/carplay) | Not current | No automotive feature |
| Game Center | [Source](https://developer.apple.com/design/human-interface-guidelines/game-center) | Not current | Not a game |
| Generative AI | [Source](https://developer.apple.com/design/human-interface-guidelines/generative-ai) | Later | Only if product scope changes |
| HealthKit | [Source](https://developer.apple.com/design/human-interface-guidelines/healthkit) | Not current | No health feature |
| HomeKit | [Source](https://developer.apple.com/design/human-interface-guidelines/homekit) | Not current | No home feature |
| iCloud | [Source](https://developer.apple.com/design/human-interface-guidelines/icloud) | Later | Account/sync review |
| ID Verifier | [Source](https://developer.apple.com/design/human-interface-guidelines/id-verifier) | Not current | No ID verification |
| iMessage apps and stickers | [Source](https://developer.apple.com/design/human-interface-guidelines/imessage-apps-and-stickers) | Not current | In-app messaging only |
| In-app purchase | [Source](https://developer.apple.com/design/human-interface-guidelines/in-app-purchase) | Later | Monetization only |
| Live Photos | [Source](https://developer.apple.com/design/human-interface-guidelines/live-photos) | Later | Media expansion |
| Mac Catalyst | [Source](https://developer.apple.com/design/human-interface-guidelines/mac-catalyst) | Not current | No Mac app |
| Machine learning | [Source](https://developer.apple.com/design/human-interface-guidelines/machine-learning) | Later | Only approved feature scope |
| Maps | [Source](https://developer.apple.com/design/human-interface-guidelines/maps) | Apply now | Places/map utilities; B-524/B-530 |
| NFC | [Source](https://developer.apple.com/design/human-interface-guidelines/nfc) | Not current | No NFC feature |
| Photo editing | [Source](https://developer.apple.com/design/human-interface-guidelines/photo-editing) | Later | Create media tools |
| ResearchKit | [Source](https://developer.apple.com/design/human-interface-guidelines/researchkit) | Not current | No research feature |
| SharePlay | [Source](https://developer.apple.com/design/human-interface-guidelines/shareplay) | Later | Shared experience only |
| ShazamKit | [Source](https://developer.apple.com/design/human-interface-guidelines/shazamkit) | Not current | No music ID |
| Sign in with Apple | [Source](https://developer.apple.com/design/human-interface-guidelines/sign-in-with-apple) | Apply now | Authentication review; B-528 |
| Siri | [Source](https://developer.apple.com/design/human-interface-guidelines/siri) | Later | Future shortcut work |
| Tap to Pay on iPhone | [Source](https://developer.apple.com/design/human-interface-guidelines/tap-to-pay-on-iphone) | Not current | No merchant payment |
| VoiceOver | [Source](https://developer.apple.com/design/human-interface-guidelines/voiceover) | Apply now | Accessibility acceptance; B-526/B-530 |
| Wallet | [Source](https://developer.apple.com/design/human-interface-guidelines/wallet) | Not current | No passes |

## Applied Findings

| Finding | Current action |
| --- | --- |
| Tab bars navigate among top-level sections; they are not action launchers. | B-525 moves Create to a floating action and keeps only destination tabs visible. |
| Permission prompts need contextual intent and transparent purpose. | B-524 removes Search's on-mount GPS request and adds a guardrail. |
| Touch, accessibility, text sizing, contrast, and reduced motion are baseline requirements. | B-526 through B-530 sequence audit and acceptance work. |

## Maintenance Workflow

- Refresh this index after major HIG changes, WWDC design releases, Expo/iOS platform upgrades, or a new Rekkus platform capability.
- Review the official source before interpreting a guideline; this document records Rekkus decisions, not Apple wording.
- Add or update a single linked backlog item when a topic becomes actionable.
- Update owner design, product, security, release, and lesson documents with implementation truth; this index does not replace them.
