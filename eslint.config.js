const js = require('@eslint/js')
const tsParser = require('@typescript-eslint/parser')
const tsPlugin = require('@typescript-eslint/eslint-plugin')
const importPlugin = require('eslint-plugin-import-x')
const reactHooksPlugin = require('eslint-plugin-react-hooks')
const unusedImportsPlugin = require('eslint-plugin-unused-imports')

module.exports = [
  // Ignore generated/vendor/script directories
  {
    ignores: [
      'node_modules/**',
      '.expo/**',
      '.temp/**',
      '.obsidian/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'scripts/**',
      'eslint.config.js',
    ],
  },

  // TypeScript + React Native files only
  {
    files: ['**/*.ts', '**/*.tsx'],
    ...js.configs.recommended,
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        process: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        Promise: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        require: 'readonly',
        module: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'import-x': importPlugin,
      'react-hooks': reactHooksPlugin,
      'unused-imports': unusedImportsPlugin,
    },
    rules: {
      // Disable base rules replaced by TypeScript equivalents
      'no-unused-vars': 'off',
      'no-undef': 'off',

      // TypeScript
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-ignore': true,
          'ts-nocheck': true,
          'ts-check': false,
          'ts-expect-error': { descriptionFormat: '^ -- .+$' },
          minimumDescriptionLength: 3,
        },
      ],
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // Imports
      'import-x/no-duplicates': 'error',
      'import-x/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index'], 'type'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
          'newlines-between': 'never',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // ARCH-014 / ARCH-007 / B-493: App-facing orchestration uses service/data-source boundaries.
  {
    files: [
      'features/**/*.{ts,tsx}',
      'app/**/*.{ts,tsx}',
      'lib/hooks/**/*.{ts,tsx}',
      'lib/contexts/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: '@/lib/supabase',
            message: 'Use lib/services/ instead of accessing Supabase directly. See B-493.',
          },
          {
            name: '@supabase/supabase-js',
            message: 'Expose provider contracts through lib/services/ instead. See B-493.',
          },
          {
            name: '@/lib/mocks',
            message: 'Import mock data from @/lib/dataSources/demoData instead. See ARCH-007.',
          },
          {
            name: '@/lib/mocks/data',
            message: 'Import mock data from @/lib/dataSources/demoData instead. See ARCH-007.',
          },
        ],
        patterns: [
          {
            group: ['**/lib/supabase', '../supabase', '../../lib/supabase', '../../lib/mocks/**'],
            message: 'Use the appropriate lib/services or lib/dataSources boundary instead.',
          },
        ],
      }],
    },
  },

  // ARCH-015: Enforce no-explicit-any in app-facing and shared runtime code.
  {
    files: [
      'app/**/*.{ts,tsx}',
      'features/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/services/**/*.ts',
      'lib/hooks/**/*.ts',
      'lib/contexts/**/*.{ts,tsx}',
      'lib/utils/**/*.ts',
      'lib/analytics.ts',
      'supabase/functions/**/*.ts',
    ],
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Type-aware unsafe-flow checks for app/runtime TypeScript covered by tsconfig.
  {
    files: [
      'app/**/*.{ts,tsx}',
      'features/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'lib/**/*.ts',
      'lib/**/*.tsx',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'as' }],
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false, arguments: false } }],
    },
  },
]
