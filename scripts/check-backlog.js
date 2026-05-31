#!/usr/bin/env node
'use strict'
/**
 * Guardrail: each backlog item ID (B-###) must exist as an anchor in exactly
 * one of BACKLOG.md or COMPLETED_ITEMS.md — never both.
 *
 * Duplicate anchors across files mean either:
 *   (a) an item was shipped but the BACKLOG.md row wasn't removed, or
 *   (b) a new item was incorrectly assigned an ID already used by a shipped item.
 *
 * Fix: remove the stale BACKLOG.md row (if it's the same item), or give the
 * BACKLOG.md item the next unused B-### ID (if they are different items).
 */
const fs = require('fs')
const path = require('path')
const { printHelp, hasFlag } = require('./lib/args.js')

if (hasFlag('--help')) {
  printHelp('check-backlog', 'Fail if any B-### anchor ID appears in both BACKLOG.md and COMPLETED_ITEMS.md.', [])
  process.exit(0)
}

const ROOT = path.resolve(__dirname, '..')
const BACKLOG = path.join(ROOT, 'BACKLOG.md')
const COMPLETED = path.join(ROOT, 'COMPLETED_ITEMS.md')
const ANCHOR_RE = /<a id="(b-[^"]+)"><\/a>/g

function extractIds(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const ids = new Set()
  let m
  while ((m = ANCHOR_RE.exec(text)) !== null) {
    ids.add(m[1])
  }
  return ids
}

const backlogIds = extractIds(BACKLOG)
const completedIds = extractIds(COMPLETED)

const duplicates = [...backlogIds].filter(id => completedIds.has(id))

if (duplicates.length > 0) {
  for (const id of duplicates) {
    console.error(
      `FAIL [BACKLOG] <a id="${id}"> exists in both BACKLOG.md and COMPLETED_ITEMS.md. ` +
      `If shipped: delete the BACKLOG.md row. If different items: give the BACKLOG.md item the next unused B-### ID.`
    )
  }
  process.exit(1)
}

console.log(
  `check:backlog passed — ${backlogIds.size} BACKLOG anchors, ${completedIds.size} COMPLETED anchors, 0 duplicates.`
)
