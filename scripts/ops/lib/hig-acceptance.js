const REQUIRED_FIELDS = [
  'Environment',
  'App/build version',
  'Test date',
  'Tester',
  'Device type',
  'iPhone model',
  'iOS version',
  'Rollback/build reference',
]

const REQUIRED_JOURNEYS = [
  'Onboarding',
  'Auth',
  'Feed',
  'Search',
  'Saved',
  'Create',
  'Restaurant',
  'Messaging',
  'Settings',
]

const REQUIRED_DIMENSIONS = [
  'VoiceOver',
  'Dynamic Type',
  'Reduce Motion',
  'Reduce Transparency',
  'Dark Mode',
  'Permission Timing/Recovery',
  'Touch Target/Semantics',
]

function tableCells(line) {
  if (!line.trim().startsWith('|')) return []
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim())
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell))
}

function tableAfter(lines, firstHeaderCell) {
  const headerIndex = lines.findIndex(line => tableCells(line)[0] === firstHeaderCell)
  if (headerIndex === -1) return null
  const header = tableCells(lines[headerIndex])
  const rows = []

  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const cells = tableCells(lines[index])
    if (cells.length === 0) {
      if (rows.length > 0) break
      continue
    }
    if (isSeparatorRow(cells)) continue
    rows.push(cells)
  }

  return { header, rows }
}

function parseRecords(source) {
  const lines = source.split(/\r?\n/)
  const headings = []
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^## Release Candidate: `([^`]+)`\s*$/.exec(lines[index])
    if (match) headings.push({ id: match[1], index })
  }

  return headings.map((heading, index) => {
    const end = headings[index + 1]?.index ?? lines.length
    const section = lines.slice(heading.index + 1, end)
    const metadataTable = tableAfter(section, 'Field')
    const matrixTable = tableAfter(section, 'Journey')
    const metadata = new Map((metadataTable?.rows ?? []).map(row => [row[0], row[1] ?? '']))
    return {
      id: heading.id,
      metadata,
      matrixTable,
    }
  })
}

function statusFailure(candidateId, journey, dimension, status, backlogIds, activeBlockerIds) {
  if (status === 'PASS' || /^N\/A \(\S(?:.*\S)?\)$/.test(status)) return null
  const blocked = /^BLOCKED \((B-\d{3})\)$/.exec(status)
  if (blocked) {
    if (!backlogIds.has(blocked[1])) {
      return `${candidateId} ${journey}/${dimension} references missing blocker ${blocked[1]}.`
    }
    if (!activeBlockerIds.has(blocked[1])) {
      return `${candidateId} ${journey}/${dimension} references shipped blocker ${blocked[1]}; record the current blocker or result.`
    }
    return null
  }
  if (status === 'FAIL') return null
  return `${candidateId} ${journey}/${dimension} has unsupported status "${status}"; use PASS, FAIL, BLOCKED (B-###), or N/A (<reason>).`
}

function validateAcceptanceRegister(source, options = {}) {
  const failures = []
  const records = parseRecords(source)
  const backlogIds = new Set(options.backlogSource?.match(/\bB-\d{3}\b/g) ?? [])
  const activeBlockerIds = new Set(
    [
      ...(options.backlogSource?.matchAll(
        /^\|\s*\[(?: |~)\][^|\n]*\|[^|\n]*\|\s*<a id="b-\d+"><\/a>(B-\d{3})\b/gm
      ) ?? []),
    ].map(match => match[1])
  )
  const seenCandidates = new Set()

  if (records.length === 0) {
    failures.push(
      'iPhone HIG acceptance register must include at least one Release Candidate record.'
    )
  }

  for (const record of records) {
    if (seenCandidates.has(record.id)) {
      failures.push(
        `Release Candidate ${record.id} is duplicated; evidence cannot be reused for the same build ID.`
      )
    }
    seenCandidates.add(record.id)

    for (const field of REQUIRED_FIELDS) {
      if (!record.metadata.get(field)) {
        failures.push(`${record.id} is missing required metadata field "${field}".`)
      }
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.metadata.get('Test date') ?? '')) {
      failures.push(`${record.id} Test date must use YYYY-MM-DD.`)
    }

    const table = record.matrixTable
    if (!table) {
      failures.push(`${record.id} is missing the journey acceptance matrix.`)
      continue
    }
    const dimensions = table.header.slice(1)
    for (const dimension of REQUIRED_DIMENSIONS) {
      if (!dimensions.includes(dimension)) {
        failures.push(`${record.id} matrix is missing required dimension "${dimension}".`)
      }
    }

    const journeyRows = new Map()
    for (const row of table.rows) {
      const journey = row[0]
      if (journeyRows.has(journey)) {
        failures.push(`${record.id} matrix includes duplicate journey "${journey}".`)
      }
      journeyRows.set(journey, row)
    }
    for (const journey of REQUIRED_JOURNEYS) {
      const row = journeyRows.get(journey)
      if (!row) {
        failures.push(`${record.id} matrix is missing required journey "${journey}".`)
        continue
      }
      for (const dimension of REQUIRED_DIMENSIONS) {
        const dimensionIndex = table.header.indexOf(dimension)
        if (dimensionIndex === -1) continue
        const status = row[dimensionIndex] ?? ''
        const failure = statusFailure(
          record.id,
          journey,
          dimension,
          status,
          backlogIds,
          activeBlockerIds
        )
        if (failure) failures.push(failure)
      }
    }
  }

  if (options.releaseCandidate) {
    const record = records.find(candidate => candidate.id === options.releaseCandidate)
    if (!record) {
      failures.push(
        `Release candidate ${options.releaseCandidate} has no matching iPhone HIG acceptance record.`
      )
    } else {
      if (!['beta', 'production'].includes(record.metadata.get('Environment'))) {
        failures.push(`${record.id} must target beta or production for promotion evidence.`)
      }
      if (record.metadata.get('Device type') !== 'Physical iPhone') {
        failures.push(`${record.id} must be verified on a Physical iPhone before promotion.`)
      }
      if (record.matrixTable) {
        const nonPassing = []
        for (const row of record.matrixTable.rows) {
          for (let index = 1; index < row.length; index += 1) {
            if (row[index] === 'FAIL' || /^BLOCKED /.test(row[index])) {
              nonPassing.push(`${row[0]}/${record.matrixTable.header[index]}=${row[index]}`)
            }
          }
        }
        if (nonPassing.length > 0) {
          const sample = nonPassing.slice(0, 4).join(', ')
          const remainder = nonPassing.length > 4 ? `, plus ${nonPassing.length - 4} more` : ''
          failures.push(
            `${record.id} cannot be promoted with FAIL or BLOCKED results: ${sample}${remainder}.`
          )
        }
      }
    }
  }

  return { failures, records }
}

module.exports = {
  REQUIRED_DIMENSIONS,
  REQUIRED_FIELDS,
  REQUIRED_JOURNEYS,
  validateAcceptanceRegister,
}
