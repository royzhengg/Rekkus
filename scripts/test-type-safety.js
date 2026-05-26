#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const outDir = path.join(root, '.temp/type-safety-tests')
const tsconfigPath = path.join(root, 'tsconfig.type-safety.json')

fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })

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
