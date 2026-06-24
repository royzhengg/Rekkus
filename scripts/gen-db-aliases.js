#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
const DATABASE_TS = path.join(ROOT, 'types', 'database.ts')
const ALIASES_TS = path.join(ROOT, 'types', 'database.aliases.ts')

const HEADER_SENTINEL = '/* eslint-disable */'

const DB_HEADER = `/* eslint-disable */
/**
 * AUTO-GENERATED FILE — DO NOT EDIT.
 *
 * Changes will be overwritten.
 *
 * Regenerate via:
 *   npm run typegen:supabase:local
 *
 * Manual extensions belong in:
 *   types/database.extensions.ts
 */`

// Singularise only the last word of a snake_case name.
// Keep overrides minimal — only genuine English edge cases.
const LAST_WORD_OVERRIDES = {
  analytics: 'Analytics',
  series: 'Series',
}

function singulariseLast(word) {
  if (LAST_WORD_OVERRIDES[word]) return LAST_WORD_OVERRIDES[word]
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y'
  if (word.endsWith('ses')) return word.slice(0, -2)
  if (word.endsWith('ches') || word.endsWith('shes')) return word.slice(0, -2)
  if (word.endsWith('xes') || word.endsWith('zes')) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

function toSingularPascal(snakeName) {
  const parts = snakeName.split('_')
  parts[parts.length - 1] = singulariseLast(parts[parts.length - 1])
  return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

function toPascal(snakeName) {
  return snakeName.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('')
}

// Strip an existing generated header so injection is idempotent.
// Scans forward until the first line that actually belongs to the file.
function stripHeader(content) {
  if (!content.startsWith(HEADER_SENTINEL)) return content
  const lines = content.split('\n')
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('export ') || l.startsWith('import ')) break
    i++
  }
  return lines.slice(i).join('\n')
}

// Extract all entry names at exactly 6-space indentation within a section substring.
// This matches both `name: {` and `name:\n` (multi-signature overloads).
function extractNames(section) {
  const names = new Set()
  const re = /^      ([a-z][a-z0-9_]*):/gm
  let m
  while ((m = re.exec(section)) !== null) {
    names.add(m[1])
  }
  return [...names].sort()
}

function getSection(content, startToken, endToken) {
  const start = content.indexOf(startToken)
  if (start === -1) return ''
  const end = endToken ? content.indexOf(endToken, start + 1) : content.length
  return end === -1 ? content.slice(start) : content.slice(start, end)
}

function main() {
  let dbContent = fs.readFileSync(DATABASE_TS, 'utf8')

  // 1. Inject header into database.ts (idempotent).
  //    Hash order: inject header first, then hash the final file.
  const stripped = stripHeader(dbContent)
  const newDbContent = DB_HEADER + '\n' + stripped
  if (newDbContent !== dbContent) {
    fs.writeFileSync(DATABASE_TS, newDbContent, 'utf8')
    dbContent = newDbContent
  }

  // 2. Hash the final database.ts (post-header) — written into aliases for provenance.
  const sourceHash = crypto.createHash('sha256').update(dbContent).digest('hex').slice(0, 8)

  // 3. Extract section names scoped to the public schema only.
  const publicStart = dbContent.indexOf('\n  public: {')
  if (publicStart === -1) throw new Error('Could not find public schema in types/database.ts')
  const pub = dbContent.slice(publicStart)

  const tablesSection = getSection(pub, '\n    Tables: {',    '\n    Views: {')
  const viewsSection  = getSection(pub, '\n    Views: {',     '\n    Functions: {')
  const funcsSection  = getSection(pub, '\n    Functions: {', '\n    Enums: {')
  const enumsSection  = getSection(pub, '\n    Enums: {',     '\n    CompositeTypes: {')

  const tableNames = extractNames(tablesSection)
  const viewNames  = extractNames(viewsSection)
  const funcNames  = extractNames(funcsSection)
  const enumNames  = extractNames(enumsSection)

  // 4. Build aliases file.
  const out = []

  out.push(`/* eslint-disable */`)
  out.push(`/**`)
  out.push(` * AUTO-GENERATED FILE — DO NOT EDIT.`)
  out.push(` *`)
  out.push(` * Changes will be overwritten.`)
  out.push(` *`)
  out.push(` * Regenerate via:`)
  out.push(` *   npm run typegen:supabase:local`)
  out.push(` *`)
  out.push(` * Source hash: ${sourceHash}`)
  out.push(` */`)
  out.push(`import type { Database } from './database'`)
  out.push(``)

  out.push(`// ─── Tables ──────────────────────────────────────────────────────────────────`)
  for (const name of tableNames) {
    const p = toSingularPascal(name)
    out.push(`export type ${p}Row = Database['public']['Tables']['${name}']['Row']`)
    out.push(`export type ${p}Insert = Database['public']['Tables']['${name}']['Insert']`)
    out.push(`export type ${p}Update = Database['public']['Tables']['${name}']['Update']`)
    out.push(``)
  }

  if (viewNames.length > 0) {
    out.push(`// ─── Views ───────────────────────────────────────────────────────────────────`)
    for (const name of viewNames) {
      const p = toPascal(name)
      out.push(`export type ${p}Row = Database['public']['Views']['${name}']['Row']`)
      out.push(``)
    }
  }

  if (enumNames.length > 0) {
    out.push(`// ─── Enums ───────────────────────────────────────────────────────────────────`)
    for (const name of enumNames) {
      out.push(`export type ${toPascal(name)} = Database['public']['Enums']['${name}']`)
    }
    out.push(``)
  }

  if (funcNames.length > 0) {
    out.push(`// ─── RPC Args / Returns ──────────────────────────────────────────────────────`)
    for (const name of funcNames) {
      const p = toPascal(name)
      out.push(`export type ${p}Args = Database['public']['Functions']['${name}']['Args']`)
      out.push(`export type ${p}Returns = Database['public']['Functions']['${name}']['Returns']`)
      out.push(``)
    }
  }

  out.push(`// ─── Schema key unions ────────────────────────────────────────────────────────`)
  out.push(`export type TableName    = keyof Database['public']['Tables']`)
  out.push(`export type ViewName     = keyof Database['public']['Views']`)
  out.push(`export type EnumName     = keyof Database['public']['Enums']`)
  out.push(`export type FunctionName = keyof Database['public']['Functions']`)
  out.push(``)

  fs.writeFileSync(ALIASES_TS, out.join('\n'), 'utf8')
  console.log(
    `✓ Generated types/database.aliases.ts` +
    ` (${tableNames.length} tables, ${viewNames.length} views,` +
    ` ${enumNames.length} enums, ${funcNames.length} functions)`
  )
}

main()
