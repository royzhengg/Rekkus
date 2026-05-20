const { readText } = require('./files')

const BACKLOG_HEADER =
  '| Status | Priority | ID | Item | Why It Matters | Dependencies | Burden | Problem | Suggested AI Command | Implementations | Implementation Type |'

function hasExpectedBacklogSchema() {
  return readText('BACKLOG.md').includes(BACKLOG_HEADER)
}

function parseBacklogRows() {
  const source = readText('BACKLOG.md')
  const rows = []

  for (const line of source.split('\n')) {
    const idMatch = line.match(/<a id="b-\d+"><\/a>(B-\d+)/)
    if (!idMatch) continue

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())

    rows.push({
      id: idMatch[1],
      line,
      status: cells[0] ?? '',
      priority: cells[1] ?? '',
      item: cells[3] ?? '',
      why: cells[4] ?? '',
      dependencies: cells[5] ?? '',
      burden: cells[6] ?? '',
      problem: cells[7] ?? '',
      command: cells[8] ?? '',
      implementation: cells[9] ?? '',
      implementationType: cells[10] ?? '',
      cellCount: cells.length,
    })
  }

  return rows
}

function duplicateBacklogIds(rows) {
  const seen = new Set()
  const duplicates = new Set()
  for (const row of rows) {
    if (seen.has(row.id)) duplicates.add(row.id)
    seen.add(row.id)
  }
  return [...duplicates].sort()
}

function rowsById(rows) {
  return new Map(rows.map((row) => [row.id, row]))
}

module.exports = {
  BACKLOG_HEADER,
  duplicateBacklogIds,
  hasExpectedBacklogSchema,
  parseBacklogRows,
  rowsById,
}
