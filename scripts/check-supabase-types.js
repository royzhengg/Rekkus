#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const generatedPath = path.join(root, '.temp/supabase-database.generated.ts')
const databasePath = path.join(root, 'types/database.ts')
const strict = process.argv.includes('--strict') || process.env.REQUIRE_SUPABASE_LOCAL === '1'

function skip(message) {
  if (strict) {
    console.error(`Supabase type check failed: ${message}`)
    process.exit(1)
  }
  console.log(`Supabase type check skipped: ${message}`)
  process.exit(0)
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    ...options,
  })
}

const status = run('supabase', ['status'])
if (status.error && status.error.code === 'ENOENT') {
  skip('Supabase CLI is not installed.')
}
if (status.status !== 0) {
  skip('local Supabase is not running.')
}

fs.mkdirSync(path.dirname(generatedPath), { recursive: true })
const generated = run('supabase', ['gen', 'types', 'typescript', '--local'])
if (generated.status !== 0) {
  console.error('Supabase type check failed: could not generate local types.')
  if (generated.stderr) console.error(generated.stderr.trim())
  process.exit(generated.status ?? 1)
}

fs.writeFileSync(generatedPath, generated.stdout)
const current = fs.readFileSync(databasePath, 'utf8')
if (current !== generated.stdout) {
  console.error('Supabase type check failed: types/database.ts is stale.')
  console.error('Run npm run typegen:supabase:local and commit the updated generated types.')
  process.exit(1)
}

console.log('Supabase type check passed.')
