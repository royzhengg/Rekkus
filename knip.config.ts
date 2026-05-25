import type { KnipConfig } from 'knip'

export default {
  // Expo Router: every file under app/ is an implicit entry point.
  // types/database.ts is auto-generated; its exports are accessed via
  // Database['public']['Tables']['foo']['Row'] indexed-type syntax which
  // knip cannot trace — treat the whole file as public API surface.
  entry: [
    'app/**/*.{ts,tsx}',
    'babel.config.js',
    'tests/**/*.{ts,tsx,js}',
    'types/database.ts',
  ],
  project: ['**/*.{ts,tsx,js}'],
  ignore: [
    // Standalone Node.js ops/CI scripts — not part of the app module graph
    'scripts/**',
    // Supabase Edge Functions are excluded from tsconfig too
    'supabase/**',
    // Temp artifacts written by test-type-safety.js
    '.temp/**',
    'coverage/**',
  ],
  ignoreDependencies: [
    // Listed in package.json but pulled in through Expo's plugin/peer system
    '@expo/vector-icons',
    'expo-av',
    // Used in eslint.config.js — Knip doesn't resolve eslint config imports
    'eslint-config-expo',
    'eslint-config-prettier',
    // Git-hooks runner — not imported into app code
    'husky',
    // Used in app.config.js plugins array (not resolvable via static analysis)
    'expo-updates',
    'expo-system-ui',
    // Transitive deps referenced directly — add to package.json as follow-up
    '@react-navigation/bottom-tabs',
    'expo-file-system',
    // Expo status bar consumed via Expo plugin, not direct import
    'expo-status-bar',
  ],
  ignoreBinaries: ['supabase'],

  // ── Phased enforcement ────────────────────────────────────────────────────
  // Phase 2 active (2026-05-25): unused exports and types are now enforced.
  // New exports must be consumed, removed, or added to ignoreIssues below.
  // Phase 3 (duplicates) is still excluded.
  exclude: ['duplicates'],

  // ── Baseline unused files (2026-05-23) ────────────────────────────────────
  // Real dead code, suppressed so CI stays green on day 1 (ratchet baseline).
  // Delete an entry here only after the file is either used or removed.
  ignoreFiles: [
    'components/ErrorBoundary.tsx',
    'components/ui/ScreenHeader.tsx',
    'features/messages/CreateGroupScreen.tsx',
    'lib/data.ts',
  ],

  // ── Phase 2 baseline: unused exports/types (2026-05-25) ──────────────────
  // Maps file paths to the issue categories suppressed for that file.
  // Suppress only files with exports not yet consumed by a feature, or
  // pre-built API surface for features under development.
  //
  // HOW TO CLEAR: as a feature is wired, imports flow to the service and knip
  // stops reporting the exports — remove the entry when the file is clean.
  // New files and new violations in non-listed files ARE caught by CI.
  ignoreIssues: {
    // Design token / config files — all exports are intentional public API.
    'constants/Colors.ts': ['exports'],
    'constants/Typography.ts': ['exports'],
    'lib/animations.ts': ['exports'],
    'lib/config.ts': ['exports', 'types'],
    'lib/dataSources/cuisines.ts': ['exports'],

    // Icon inventory — not all icons need to be in active use simultaneously.
    'components/icons/account-status.tsx': ['exports'],
    'components/icons/messaging-layout.tsx': ['exports'],

    // Analytics helpers — exported for metric consumers not yet wired.
    'lib/analytics.ts': ['exports'],

    // Service layer — pre-built APIs for features not yet connected to UI.
    // Remove file entry once the feature is wired and exports become live.
    'lib/services/collections.ts': ['exports', 'types'],
    'lib/services/comments.ts': ['exports', 'types'],
    'lib/services/crashReporting.ts': ['exports'],
    'lib/services/googlePlacesGuards.ts': ['exports'],
    'lib/services/media.ts': ['exports', 'types'],
    'lib/services/messageAttachments.ts': ['exports'],
    'lib/services/messaging.ts': ['exports'],
    'lib/services/messaging/messages.ts': ['exports'],
    'lib/services/messaging/participants.ts': ['exports'],
    'lib/services/moderation.ts': ['exports', 'types'],
    'lib/services/notifications.ts': ['exports'],
    'lib/services/offlineCache.ts': ['exports'],
    'lib/services/postDrafts.ts': ['exports', 'types'],
    'lib/services/postDrafts/guards.ts': ['types'],
    'lib/services/postDrafts/types.ts': ['types'],
    'lib/services/posts.ts': ['exports', 'types'],
    'lib/services/posts/guards.ts': ['exports'],
    'lib/services/posts/queries.ts': ['exports'],
    'lib/services/posts/social.ts': ['exports'],
    'lib/services/postUploadGuards.ts': ['exports', 'types'],
    'lib/services/restaurants.ts': ['exports', 'types'],
    'lib/services/restaurants/governance.ts': ['exports'],
    'lib/services/search.ts': ['types'],
    'lib/services/searchGuards.ts': ['exports'],
    'lib/services/users.ts': ['exports', 'types'],

    // Utility files with exports not yet consumed.
    'lib/utils/locationResolver.ts': ['exports'],
    'lib/utils/restaurantNavigation.ts': ['exports'],
    'lib/utils/safeJson.ts': ['exports'],
    'lib/utils/searchScoring.ts': ['exports'],

    // Hook/context types exported for future consumers.
    'lib/contexts/PostUploadContext.tsx': ['types'],
    'lib/hooks/useSearch.ts': ['types'],
    'lib/hooks/useSearchResults.ts': ['types'],
    'lib/utils/queryParser.ts': ['types'],

    // Domain type not yet imported by name; used as sub-type of Post.
    'types/domain.ts': ['types'],
  },
} satisfies KnipConfig
