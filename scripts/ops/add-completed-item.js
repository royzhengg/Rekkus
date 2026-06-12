#!/usr/bin/env node
'use strict';
/**
 * Safe helper for inserting a completed row into COMPLETED_ITEMS.md.
 *
 * Agents should use this script instead of hand-editing COMPLETED_ITEMS.md to
 * avoid formatting errors, ordering violations, and duplicate IDs.
 *
 * Usage:
 *   node scripts/ops/add-completed-item.js \
 *     --id B-587 \
 *     --priority P2 \
 *     --status "[x]" \
 *     --item "Short deliverable name" \
 *     --problem "Full problem statement. Depends on: X. Burden: Medium. Do: ..." \
 *     --implementations "Shipped evidence with paths/checks." \
 *     --type runtime-feature
 *
 * Valid --type values:
 *   runtime-feature | migration | guardrail | automation | ops-workflow |
 *   docs | restructure | audit | policy | none
 */

const fs = require('fs');
const path = require('path');
const { getArg } = require('../lib/args');

const ROOT = path.resolve(__dirname, '..', '..');
const COMPLETED = path.join(ROOT, 'COMPLETED_ITEMS.md');

const VALID_TYPES = new Set([
  'runtime-feature', 'migration', 'guardrail', 'automation', 'ops-workflow',
  'docs', 'restructure', 'audit', 'policy', 'none',
]);

const VALID_STATUSES = new Set(['[x]', '[~]', '[ ]', 'Deprioritized']);
const ID_RE = /^B-\d+$/i;

function required(flag) {
  const val = getArg(flag);
  if (!val) {
    console.error(`[add-completed-item] Missing required flag: ${flag}`);
    process.exit(1);
  }
  return val;
}

const id = required('--id').toUpperCase();
const priority = getArg('--priority') || 'P2';
const status = getArg('--status') || '[x]';
const item = required('--item');
const problem = required('--problem');
const implementations = required('--implementations');
const implType = required('--type');

// ─── validation ──────────────────────────────────────────────────────────────

const errors = [];

if (!ID_RE.test(id)) errors.push(`--id "${id}" must match B-NNN format (e.g. B-587).`);
if (!VALID_STATUSES.has(status)) errors.push(`--status "${status}" must be one of: ${[...VALID_STATUSES].join(', ')}.`);
if (!VALID_TYPES.has(implType)) errors.push(`--type "${implType}" must be one of: ${[...VALID_TYPES].join(', ')}.`);

if (errors.length) {
  for (const e of errors) console.error(`[add-completed-item] ${e}`);
  process.exit(1);
}

// Sanitise cell content: replace literal | with em-dash to avoid breaking tables
function sanitise(s) { return s.replace(/\|/g, '—'); }

const idNum = parseInt(id.replace(/^B-/i, ''), 10);
const paddedId = `B-${String(idNum).padStart(3, '0')}`;
const anchorId = `b-${String(idNum).padStart(3, '0')}`;

const newRow = `| ${status} | ${priority} | <a id="${anchorId}"></a>${paddedId} | ${sanitise(item)} | ${sanitise(problem)} | ${sanitise(implementations)} | ${implType} |`;

// ─── insertion ───────────────────────────────────────────────────────────────

const content = fs.readFileSync(COMPLETED, 'utf8');

// Check for duplicate
if (content.includes(`<a id="${anchorId}">`)) {
  console.error(`[add-completed-item] ${paddedId} already exists in COMPLETED_ITEMS.md. Aborting.`);
  process.exit(1);
}

// Find correct ascending-ID insertion position
const lines = content.split('\n');
const ANCHOR_RE = /<a id="b-(\d+)"><\/a>/i;

let insertAfter = -1; // line index to insert after (insert before insertAfter+1)

for (let i = 0; i < lines.length; i++) {
  const m = ANCHOR_RE.exec(lines[i]);
  if (!m) continue;
  const rowId = parseInt(m[1], 10);
  if (rowId < idNum) insertAfter = i;
  if (rowId > idNum) break; // passed the insertion point
}

if (insertAfter === -1) {
  // No row with a lower ID found — insert after the column header+separator
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('| Status |') && lines[i].includes('| Problem |')) {
      // Look for separator row right after
      if (i + 1 < lines.length && /^\| [-| ]+\|$/.test(lines[i + 1])) {
        insertAfter = i + 1;
        break;
      }
    }
  }
}

if (insertAfter === -1) {
  console.error('[add-completed-item] Could not find insertion position in COMPLETED_ITEMS.md. Aborting.');
  process.exit(1);
}

lines.splice(insertAfter + 1, 0, newRow);
fs.writeFileSync(COMPLETED, lines.join('\n'), 'utf8');

console.log(`[add-completed-item] Inserted ${paddedId} after line ${insertAfter + 1} in COMPLETED_ITEMS.md.`);
console.log(`  Row: ${newRow.slice(0, 120)}...`);
