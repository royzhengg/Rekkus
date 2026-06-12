#!/usr/bin/env node
'use strict';
// Backlog integrity checks — 8 checks covering orphaned tables, status evidence,
// ID coverage, ordering, duplicates, phase plan blocks, multi-agent overlap, cell count.
// Run before and after any work on BACKLOG.md, COMPLETED_ITEMS.md, backlog-counter.md, worklog.md.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKLOG = path.join(ROOT, 'BACKLOG.md');
const COMPLETED = path.join(ROOT, 'COMPLETED_ITEMS.md');
const COUNTER = path.join(ROOT, 'backlog-counter.md');
const WORKLOG = path.join(ROOT, 'worklog.md');

const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch { fail(`[BACKLOG] Cannot read ${path.basename(p)}`); return ''; }
}
function isSepRow(l) {
  if (!l.startsWith('|') || !l.endsWith('|')) return false;
  return l.split('|').slice(1,-1).every(c => /^[-\s]+$/.test(c));
}
function isHdrRow(l) { return l.startsWith('|') && l.includes('Status') && l.includes('Problem') && !isSepRow(l); }
function isDataRow(l) { return l.startsWith('|') && l.endsWith('|') && !isSepRow(l); }
function cellCount(l) { return l.split('|').length - 2; }
function extractAnchors(text) {
  const ids = []; let m; const re = /<a id="(b-\d+)"><\/a>/gi;
  while ((m = re.exec(text)) !== null) ids.push(m[1].toLowerCase());
  return ids;
}
function parseCounterMax(text) {
  const m = text.match(/Next backlog ID:\s*B-(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function checkOrphanedHeaders(filePath, text) {
  const lines = text.split('\n');
  const name = path.basename(filePath);
  let sectionName = '(unknown)';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('#')) sectionName = line.replace(/^#+\s*/, '');
    if (!isHdrRow(line)) continue;

    // Expect next non-blank line to be a separator, then a data row
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === '') j++;
    if (j >= lines.length || !isSepRow(lines[j].trim())) continue;

    // Now look for first data row after separator
    let k = j + 1;
    while (k < lines.length && lines[k].trim() === '') k++;
    const next = k < lines.length ? lines[k].trim() : '';

    if (!next.startsWith('|') || isSepRow(next) || isHdrRow(next)) {
      fail(`[BACKLOG] Orphaned table header in ${name} (section: "${sectionName}", line ${i + 1}) — header+separator with no data rows. Replace with "_All items shipped — see COMPLETED_ITEMS.md._"`);
    }
  }
}

checkOrphanedHeaders(BACKLOG, readFile(BACKLOG));



function checkInProgressEvidence(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!isDataRow(line)) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 7) continue;
    const status = cells[0];
    const id = cells[2];
    const implementations = cells[5]; // 0-indexed: Status, Priority, ID, Item, Problem, Implementations, ImplType
    if (status === '[~]' && /not implemented yet/i.test(implementations)) {
      fail(`[BACKLOG] ${id} has status [~] but Implementations says "Not implemented yet" — change to [ ] or add real partial evidence.`);
    }
  }
}

checkInProgressEvidence(readFile(BACKLOG));


function checkIdCoverage() {
  const counterText = readFile(COUNTER);
  const maxId = parseCounterMax(counterText);
  if (!maxId) { warn('[BACKLOG] Could not parse next ID from backlog-counter.md — skipping ID coverage check.'); return; }

  const backlogAnchors = new Set(extractAnchors(readFile(BACKLOG)));
  const completedAnchors = new Set(extractAnchors(readFile(COMPLETED)));

  for (let i = 1; i < maxId; i++) {
    // Anchors use zero-padded 3-digit format (b-001, b-013, b-100, etc.)
    const key = `b-${String(i).padStart(3, '0')}`;
    if (!backlogAnchors.has(key) && !completedAnchors.has(key)) {
      warn(`[BACKLOG] ID gap: B-${String(i).padStart(3, '0')} not found in BACKLOG.md or COMPLETED_ITEMS.md — add a stub row explaining the disposition.`);
    }
  }
}

checkIdCoverage();


function checkCompletedOrder(text) {
  const anchors = extractAnchors(text);
  const nums = anchors.map(a => parseInt(a.replace('b-', ''), 10));
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] <= nums[i - 1]) {
      fail(`[BACKLOG] COMPLETED_ITEMS.md ID ordering violation: B-${nums[i - 1]} followed by B-${nums[i]} (must be strictly ascending). Fix the insertion position.`);
      break; // report first violation only
    }
  }
}

checkCompletedOrder(readFile(COMPLETED));


function checkDuplicateIds() {
  const backlogSet = new Set(extractAnchors(readFile(BACKLOG)));
  const completedSet = new Set(extractAnchors(readFile(COMPLETED)));
  for (const id of backlogSet) {
    if (completedSet.has(id)) {
      fail(`[BACKLOG] Duplicate ID ${id.toUpperCase()} exists in both BACKLOG.md and COMPLETED_ITEMS.md — remove the stale BACKLOG.md row if shipped, or assign a new ID.`);
    }
  }
}

checkDuplicateIds();


function checkNoPhasePlanBlocks(text, filePath) {
  const name = path.basename(filePath);
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (/^Phase \d+ \(/.test(lines[i].trim())) {
      fail(`[BACKLOG] ${name} line ${i + 1}: inline phase plan block ("Phase N (...)") — remove it. Use Priority and Dependencies in row cells instead.`);
    }
  }
}

checkNoPhasePlanBlocks(readFile(BACKLOG), BACKLOG);


function checkAgentOverlap() {
  const worklogText = readFile(WORKLOG);
  if (!worklogText) return;

  // Parse Active Work table rows (lines between header and next section/blank)
  const lines = worklogText.split('\n');
  const activeRows = [];
  let inActiveTable = false;

  for (const line of lines) {
    if (line.includes('## Active Work')) { inActiveTable = true; continue; }
    if (inActiveTable && line.startsWith('## ')) break;
    if (!inActiveTable || !line.startsWith('|')) continue;
    if (isSepRow(line) || line.includes('Agent / Session')) continue;

    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 3) continue;
    const agent = cells[0];
    const filesClaimed = cells[2] || '';
    if (agent && filesClaimed) activeRows.push({ agent, filesClaimed });
  }

  if (activeRows.length < 2) return; // only warn when 2+ agents are active

  // Extract section claims for BACKLOG.md and ID range claims for COMPLETED_ITEMS.md
  function parseSectionClaims(filesClaimed) {
    const sections = [];
    const sectionRe = /BACKLOG\.md\s*§\s*([^,;|]+)/gi;
    let m;
    while ((m = sectionRe.exec(filesClaimed)) !== null) sections.push(m[1].trim().toLowerCase());
    return sections;
  }

  function parseIdRangeClaims(filesClaimed) {
    const ranges = [];
    const rangeRe = /COMPLETED_ITEMS\.md\s*\[B-(\d+)[–-]B-(\d+)\]/gi;
    let m;
    while ((m = rangeRe.exec(filesClaimed)) !== null) ranges.push([parseInt(m[1], 10), parseInt(m[2], 10)]);
    return ranges;
  }

  function rangesOverlap([a1, a2], [b1, b2]) {
    return a1 <= b2 && b1 <= a2;
  }

  // Check for overlapping BACKLOG.md section claims
  for (let i = 0; i < activeRows.length; i++) {
    for (let j = i + 1; j < activeRows.length; j++) {
      const sectA = parseSectionClaims(activeRows[i].filesClaimed);
      const sectB = parseSectionClaims(activeRows[j].filesClaimed);
      for (const s of sectA) {
        if (sectB.includes(s)) {
          fail(`[BACKLOG] Agent overlap: "${activeRows[i].agent}" and "${activeRows[j].agent}" both claim BACKLOG.md § ${s} — coordinate before proceeding.`);
        }
      }

      const rangesA = parseIdRangeClaims(activeRows[i].filesClaimed);
      const rangesB = parseIdRangeClaims(activeRows[j].filesClaimed);
      for (const ra of rangesA) {
        for (const rb of rangesB) {
          if (rangesOverlap(ra, rb)) {
            fail(`[BACKLOG] Agent overlap: "${activeRows[i].agent}" and "${activeRows[j].agent}" claim overlapping COMPLETED_ITEMS.md ID ranges — coordinate before proceeding.`);
          }
        }
      }
    }
  }

  // Warn about agents not using section-level claiming
  for (const row of activeRows) {
    const claimsBacklog = row.filesClaimed.includes('BACKLOG.md');
    const hasSection = /BACKLOG\.md\s*§/.test(row.filesClaimed);
    if (claimsBacklog && !hasSection) {
      warn(`[BACKLOG] Agent "${row.agent}" claims BACKLOG.md without naming a section (use "BACKLOG.md § Section Name"). Required when multiple agents may be active.`);
    }
    const claimsCompleted = row.filesClaimed.includes('COMPLETED_ITEMS.md');
    const hasRange = /COMPLETED_ITEMS\.md\s*\[B-/.test(row.filesClaimed);
    if (claimsCompleted && !hasRange) {
      warn(`[BACKLOG] Agent "${row.agent}" claims COMPLETED_ITEMS.md without an ID range (use "COMPLETED_ITEMS.md [B-NNN–B-MMM]"). Required when multiple agents may be active.`);
    }
  }
}

checkAgentOverlap();


function checkRowCellCount(filePath, text) {
  const name = path.basename(filePath);
  const lines = text.split('\n');
  // Track whether we're inside a recognised 7-column backlog table (avoid flagging
  // 2-column documentation tables like the Column Guide).
  let insideBacklogTable = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isHdrRow(line)) {
      // Only enter backlog-table mode when the header contains the canonical 7-column names
      insideBacklogTable = line.includes('Status') && line.includes('Problem') &&
                           line.includes('Implementations') && line.includes('Implementation Type');
      continue;
    }

    if (isSepRow(line)) continue;

    // Exit table mode on blank lines or section headers
    if (line.trim() === '' || line.startsWith('#')) {
      insideBacklogTable = false;
      continue;
    }

    if (!insideBacklogTable) continue;
    if (!isDataRow(line)) continue;

    const count = cellCount(line);
    if (count !== 7) {
      fail(`[BACKLOG] ${name} line ${i + 1}: row has ${count} cells (expected 7). Fix the row to match the 7-column schema (Status · Priority · ID · Item · Problem · Implementations · Implementation Type).`);
    }
  }
}

checkRowCellCount(BACKLOG, readFile(BACKLOG));
checkRowCellCount(COMPLETED, readFile(COMPLETED));


for (const w of warnings) console.warn(`[WARN]  ${w}`);
for (const e of errors) console.error(`[FAIL]  ${e}`);

if (errors.length > 0) {
  console.error(`\ncheck:backlog-integrity FAILED — ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(1);
}

console.log(`check:backlog-integrity passed — 0 errors, ${warnings.length} warning(s).`);
