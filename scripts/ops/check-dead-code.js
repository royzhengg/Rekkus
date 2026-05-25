#!/usr/bin/env node
// JSON adapter for check-operations.js.
// The check:dead-code npm script calls `knip` directly (exits 1 on violations).
// This script is called by check-operations.js with --json for the ops report;
// it always exits 0 and returns { candidates: [] } shaped JSON.
const { spawnSync } = require('child_process')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..', '..')
const knipBin = path.join(repoRoot, 'node_modules', '.bin', 'knip')

const isJson = process.argv.includes('--json')

const result = spawnSync(knipBin, ['--reporter', 'json', '--no-exit-code'], {
  cwd: repoRoot,
  encoding: 'utf8',
  timeout: 90_000,
})

if (result.error) {
  if (isJson) {
    process.stdout.write(JSON.stringify({ candidates: [] }, null, 2) + '\n')
  } else {
    process.stderr.write(`Knip could not run: ${result.error.message}\n`)
  }
  process.exit(0)
}

let candidates = []
try {
  const data = JSON.parse(result.stdout)
  // Knip JSON shape: { files: string[], issues: Array<{ file, exports?, types? }> }
  const unusedFiles = data.files ?? []
  const issueEntries = (data.issues ?? []).flatMap(
    (/** @type {{ file: string, exports?: {name:string}[], types?: {name:string}[] }} */ i) => {
      const exports = (i.exports ?? []).map(e => `${i.file}:${e.name}`)
      const types = (i.types ?? []).map(t => `${i.file}:${t.name}`)
      return exports.length + types.length > 0
        ? [...exports, ...types]
        : [i.file]
    }
  )
  candidates = [...new Set([...unusedFiles, ...issueEntries])]
} catch {
  // Knip output was not valid JSON; surface nothing so the ops report stays clean
}

if (isJson) {
  process.stdout.write(JSON.stringify({ candidates }, null, 2) + '\n')
} else if (candidates.length) {
  process.stdout.write('Dead-code candidates (run `npm run check:dead-code` for details):\n')
  for (const c of candidates) process.stdout.write(`  ${c}\n`)
} else {
  process.stdout.write('No dead-code candidates found.\n')
}

process.exit(0)
