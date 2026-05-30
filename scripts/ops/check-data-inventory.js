#!/usr/bin/env node
const {
  extractCreatedTables,
  getComplianceDoc,
  hasRls,
  printResult,
  readSchemaSource,
} = require('./lib/policy-checks')

const { parseFlags } = require('../lib/args')
const args = parseFlags()
const failures = []
const warnings = []
const schema = readSchemaSource()
const compliance = getComplianceDoc()
const tables = [...new Set(extractCreatedTables(schema))]

for (const table of tables) {
  if (!hasRls(schema, table)) failures.push(`public.${table} is created without RLS enabled.`)
  if (!new RegExp(`\\|\\s*${table}\\s*\\|`, 'i').test(compliance)) {
    warnings.push(`Data inventory should classify public.${table}.`)
  }
}

const requiredProviders = ['Google Places', 'Google Maps', 'Supabase', 'Expo', 'Resend', 'Storage']
for (const provider of requiredProviders) {
  if (!new RegExp(provider, 'i').test(compliance)) {
    failures.push(`Data inventory/provider register must include ${provider}.`)
  }
}

printResult({
  name: 'Data inventory checks',
  failures,
  warnings,
  summary: { tables: tables.length, classifiedWarnings: warnings.length },
}, args)
