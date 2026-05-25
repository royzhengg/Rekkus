#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, '.temp/type-safety-tests')
const tsconfigPath = path.join(outDir, 'tsconfig.json')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

const tsconfig = {
  compilerOptions: {
    strict: true,
    noImplicitAny: true,
    strictNullChecks: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noFallthroughCasesInSwitch: true,
    noImplicitOverride: true,
    forceConsistentCasingInFileNames: true,
    skipLibCheck: true,
    module: 'CommonJS',
    target: 'ES2022',
    moduleResolution: 'Node',
    baseUrl: root,
    paths: { '@/*': ['*'] },
    rootDir: root,
    outDir,
    esModuleInterop: true,
    types: ['node'],
  },
  include: [
    path.join(root, 'tests/type-safety/**/*.ts'),
    path.join(root, 'lib/utils/safeJson.ts'),
    path.join(root, 'lib/utils/routeParams.ts'),
    path.join(root, 'lib/services/googlePlacesGuards.ts'),
    path.join(root, 'lib/services/messaging/guards.ts'),
    path.join(root, 'lib/services/postUploadGuards.ts'),
    path.join(root, 'lib/services/postDrafts/guards.ts'),
    path.join(root, 'lib/services/posts/guards.ts'),
    path.join(root, 'lib/services/searchGuards.ts'),
    path.join(root, 'lib/services/moderationGuards.ts'),
    path.join(root, 'supabase/functions/_shared/guards.ts'),
  ],
}

fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2))

execFileSync('node', [
  'node_modules/typescript/bin/tsc',
  '--project',
  tsconfigPath,
], {
  cwd: root,
  stdio: 'inherit',
})

execFileSync('node', [
  '--test',
  path.join(outDir, 'tests/type-safety/index.test.js'),
  path.join(root, 'tests/type-safety/unsafeAnyRules.test.js'),
  path.join(root, 'tests/type-safety/errorSurfaceRules.test.js'),
  path.join(root, 'tests/type-safety/canonicalRegistryRules.test.js'),
  path.join(root, 'tests/type-safety/loadingSurfaceRules.test.js'),
  path.join(root, 'tests/type-safety/runtimeBoundaryRules.test.js'),
  path.join(root, 'tests/type-safety/serviceBoundaryRules.test.js'),
  path.join(root, 'tests/type-safety/asyncSafetyRules.test.js'),
], {
  cwd: root,
  stdio: 'inherit',
})
