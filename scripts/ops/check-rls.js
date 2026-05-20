#!/usr/bin/env node
const {
  extractCreatedTables,
  hasPolicy,
  hasRls,
  printResult,
  publicWritePolicies,
  readSchemaSource,
} = require('./lib/policy-checks')

const args = new Set(process.argv.slice(2))
const failures = []
const warnings = []
const schema = readSchemaSource()
const tables = [...new Set(extractCreatedTables(schema))]

for (const table of tables) {
  if (!hasRls(schema, table)) failures.push(`public.${table} must enable row level security.`)
  if (!hasPolicy(schema, table)) warnings.push(`public.${table} has RLS but no explicit policy found in migrations.`)
}

for (const policy of publicWritePolicies(schema)) {
  warnings.push(`Review broad public write policy: ${policy}`)
}

printResult({
  name: 'RLS checks',
  failures,
  warnings,
  summary: { tables: tables.length },
}, args)
