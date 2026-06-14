/** @type {import('jest').Config} */
const config = {
  preset: 'jest-expo',
  watchman: false,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '@react-native-async-storage/async-storage': require.resolve(
      '@react-native-async-storage/async-storage/jest/async-storage-mock.js',
    ),
  },
  // Type-safety fixtures run through their own Node runner; Jest owns unit tests only.
  roots: ['<rootDir>/tests/unit'],
  // Allow Jest to transform ES-module-only packages used by React Native and Expo.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/(?!.*array-buffer)|@expo-google-fonts|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated)',
  ],
  testMatch: [
    '**/__tests__/**/*.{ts,tsx}',
    '**/*.test.{ts,tsx}',
  ],
  // The tests/type-safety suite uses Node's native test runner, not Jest.
  testPathIgnorePatterns: ['/node_modules/', '/tests/type-safety/'],
  collectCoverageFrom: [
    'lib/utils/**/*.ts',
    'lib/services/**/*.ts',
    'lib/hooks/**/*.ts',
    'lib/routes/**/*.ts',
    '!lib/**/*.d.ts',
    '!lib/mocks/**',
  ],
  // B-512 ratchets: keep high-risk shared paths covered while broader service
  // wrappers become testable. Raise these floors as behaviour tests expand.
  coverageThreshold: {
    './lib/utils/': {
      statements: 10,
    },
    './lib/routes/index.ts': {
      statements: 100,
    },
    './lib/utils/searchScoring.ts': {
      statements: 68,
    },
    './lib/services/search.ts': {
      statements: 32,
    },
    './lib/services/posts/types.ts': {
      statements: 100,
    },
    './lib/hooks/useSearch.ts': {
      statements: 50,
    },
    './lib/hooks/useAutocomplete.ts': {
      statements: 94,
    },
    './lib/hooks/useRestaurantSearch.ts': {
      statements: 86,
    },
  },
}

module.exports = config
